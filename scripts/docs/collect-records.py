#!/usr/bin/env python3
"""Read-only, standard-library Markdown snapshot collector. See README.md."""
import argparse
import collections
import datetime as dt
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import posixpath
import re
import stat
import subprocess
import tempfile
import unicodedata
import urllib.parse
import zipfile

MAX_FILE = 8 * 1024 * 1024
MAX_MEMBERS = 2000
MAX_ARCHIVE_TOTAL = 64 * 1024 * 1024
MAX_ARCHIVE_FILE = 16 * 1024 * 1024
MAX_RATIO = 100
SKIP_DIRS = {'.git', 'node_modules', '.venv', 'venv', '__pycache__', 'published-records'}
DISPOSITIONS = {'published', 'deduplicated', 'withheld', 'excluded', 'unstable/pending'}
PATTERNS = {
    'private_key': r'-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----',
    'provider_token': r'\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{25,}|sk-(?:proj-)?[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{15,})\b',
    'connection_userpass': r'(?:postgres(?:ql)?(?:\+[a-z]+)?|mysql|mongodb(?:\+srv)?|redis)://[^\s:@]+:[^\s@]+@',
    'credential_assignment': r'(?i)(?:password|secret|token|api_key|bootstrap[_ -]token)\s*[=:]\s*[`\"\x27]?[A-Za-z0-9_+/.-]{8,}',
    'email': r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}',
    'financial_identifier': r'\b(?:UA\d{27}|(?:\d[ -]?){16})\b',
    'personal_health_finance': r'(?i)(?:patient|пациент|пацієнт|passport number|номер паспорта|my salary|моя зарплата|мой кредит|мій кредит)',
}
CATEGORIES = [
    'Product and architecture', 'Account security and encryption',
    'Finance and loan development', 'GTD, Tasks and Calendar',
    'Implementation reports', 'Audits and discoveries', 'Plans, backlogs and runbooks',
    'Owner decisions and unresolved questions', 'Parallel planning/discovery',
    'Historical archive records', 'Design references and prototype handoffs',
    'Other historical records',
]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + '\n').encode()


def git(root, *args, check=True):
    env = dict(os.environ, GIT_OPTIONAL_LOCKS='0')
    result = subprocess.run(['git', '-C', str(root), *args], capture_output=True, env=env)
    if check and result.returncode:
        raise RuntimeError('Git read failed: ' + ' '.join(args[:2]))
    return result.stdout if not result.returncode else None


def git_text(root, *args, check=True):
    result = git(root, *args, check=check)
    return result.decode('utf-8', errors='replace').strip() if result is not None else None


def unsafe_name(name):
    parts = PurePosixPath(name).parts
    return (not name or name.startswith('/') or '..' in parts or '\\' in name
            or ':' in name or any(ord(c) < 32 or ord(c) == 127 for c in name))


def signature(s):
    return (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns)


def stable_read(path, root, attempts=3):
    """No symlink traversal; two full reads must agree on identity, stat and hash."""
    if not path.resolve().is_relative_to(root.resolve()):
        return None, 'excluded', 'symlink leaves approved source root'
    rel = path.relative_to(root)
    if any((root.joinpath(*rel.parts[:i])).is_symlink() for i in range(1, len(rel.parts) + 1)):
        return None, 'excluded', 'symlink not followed (including in-root aliases)'
    for _ in range(attempts):
        try:
            pre = path.stat()
            if not stat.S_ISREG(pre.st_mode):
                return None, 'excluded', 'not a regular file'
            if pre.st_size > MAX_FILE:
                return None, 'excluded', 'Markdown exceeds 8 MiB file bound'
            first = path.read_bytes()
            # Copy into anonymous task-owned scratch before the after-copy read.
            with tempfile.TemporaryFile() as copied_file:
                copied_file.write(first)
                copied_file.flush()
                middle = path.stat()
                second = path.read_bytes()
                post = path.stat()
                copied_file.seek(0)
                copied = copied_file.read()
            if signature(pre) == signature(middle) == signature(post) and sha(first) == sha(second) == sha(copied):
                return copied, None, {'device': pre.st_dev, 'inode': pre.st_ino,
                                     'size': pre.st_size, 'mtime_ns': pre.st_mtime_ns,
                                     'ctime_ns': pre.st_ctime_ns, 'sha256': sha(first)}
        except (FileNotFoundError, OSError):
            continue
    return None, 'unstable/pending', 'identity, size, mtime or hash changed across three attempts'


def eligible_repo_path(rel):
    p = PurePosixPath(rel)
    return (p.suffix.lower() == '.md' and 'published-records' not in p.parts
            and (len(p.parts) == 1 or p.parts[0].lower() in {'outputs', 'docs', 'design-references'}))


def walk_documents(root, source_type):
    found = []
    def walk(folder):
        for current, dirs, files in os.walk(folder, followlinks=False):
            dirs[:] = sorted(d for d in dirs if d.lower() not in SKIP_DIRS)
            for name in sorted(files):
                p = Path(current) / name
                if p.suffix.lower() == '.md':
                    found.append(p.relative_to(root).as_posix())
            # Account for symlink directories without entering them.
            for d in dirs:
                if (Path(current) / d).is_symlink():
                    issues.append({'source_path': str(Path(current) / d), 'reason': 'symlink directory not followed'})
    issues = []
    if source_type == 'checkout':
        for p in sorted(root.iterdir()):
            if p.suffix.lower() == '.md' and (p.is_file() or p.is_symlink()):
                found.append(p.name)
            elif p.name.lower() in {'outputs', 'docs', 'design-references'} and p.is_dir():
                if p.is_symlink():
                    issues.append({'source_path': str(p), 'reason': 'symlink directory not followed'})
                else:
                    walk(p)
    else:
        walk(root)
    return sorted(set(found)), issues


def checkout_state(root):
    status_raw = git(root, 'status', '--porcelain=v1', '-z', '--untracked-files=all')
    status_items = status_raw.decode('utf-8').split('\0')
    states = {}
    i = 0
    while i < len(status_items):
        item = status_items[i]
        i += 1
        if not item:
            continue
        states[item[3:]] = item[:2]
        if 'R' in item[:2] or 'C' in item[:2]:
            i += 1
    tracked = set(git(root, 'ls-files', '-z').decode('utf-8').split('\0')) - {''}
    head = git_text(root, 'rev-parse', 'HEAD')
    branch = git_text(root, 'symbolic-ref', '--short', 'HEAD', check=False)
    index_path = Path(git_text(root, 'rev-parse', '--path-format=absolute', '--git-path', 'index'))
    return {'branch': branch, 'detached': branch is None, 'head': head,
            'origin': git_text(root, 'remote', 'get-url', 'origin', check=False),
            'dirty': bool(status_raw), 'staged': any(v[0] not in ' ?' for v in states.values()),
            'modified': any(v[1] not in ' ?' for v in states.values()),
            'untracked': any(v == '??' for v in states.values()),
            'status_sha256': sha(status_raw), 'index_sha256': sha(index_path.read_bytes())}, states, tracked


def file_state(rel, source, states, tracked):
    if source['type'] != 'checkout':
        return {'tracked': None, 'staged': None, 'modified': None, 'untracked': None,
                'porcelain': None, 'label': 'historical/archive' if source['type'] == 'archive' else 'not-applicable (non-Git source)'}
    code = states.get(rel, '  ')
    is_tracked = rel in tracked
    staged = code[0] not in ' ?'
    modified = code[1] not in ' ?'
    untracked = code == '??' or not is_tracked
    label = 'untracked' if untracked else 'tracked/committed'
    if staged:
        label = 'staged/uncommitted'
    if modified:
        label += ' + working-tree modified/uncommitted'
    return {'tracked': is_tracked, 'staged': staged, 'modified': modified,
            'untracked': untracked, 'porcelain': code, 'label': label}


def review_content(data, source, rel, policy, visibility):
    digest = sha(data)
    for item in policy.get('withheld', []):
        if source['id'] == item['source_id'] and rel == item['path']:
            return 'withheld', item['reason'], []
    try:
        text = data.decode('utf-8-sig')
    except UnicodeDecodeError:
        return 'excluded', 'not UTF-8 Markdown (binary metadata or unsupported encoding)', []
    if '\0' in text:
        return 'excluded', 'binary metadata, not a Markdown text document', []
    flags = [kind for kind, pattern in PATTERNS.items() if re.search(pattern, text)]
    approved = policy.get('reviewed_sha256', {}).get(digest)
    if flags and not approved:
        return 'withheld', 'sensitive-material review pending: ' + ', '.join(flags), flags
    if visibility == 'PUBLIC' and re.search(r'(?i)(minimal reproduction|exploit|authentication bypass)', text):
        if not approved and ('security' in rel.lower() or 'audit' in rel.lower()):
            return 'withheld', 'public disclosure review pending for potentially actionable security findings', flags
    return None, approved or 'standard-library hygiene scan; no recognized sensitive patterns', flags


def archive_documents(path):
    """Inspect every central entry before any decompression. Do not extract."""
    if path.stat().st_size > MAX_ARCHIVE_TOTAL:
        raise ValueError('compressed archive exceeds 64 MiB limit')
    with zipfile.ZipFile(path) as z:
        infos = z.infolist()
        if len(infos) > MAX_MEMBERS:
            raise ValueError('archive exceeds 2000 members')
        if sum(i.file_size for i in infos) > MAX_ARCHIVE_TOTAL:
            raise ValueError('archive exceeds 64 MiB decompressed total')
        seen = set()
        for i in infos:
            name = i.filename
            if unsafe_name(name) or stat.S_ISLNK(i.external_attr >> 16):
                raise ValueError('archive has an unsafe path or symlink')
            if name in seen:
                raise ValueError('archive has duplicate member names')
            seen.add(name)
            if i.flag_bits & 1:
                raise ValueError('encrypted archive member unsupported')
            if i.file_size > MAX_ARCHIVE_FILE or (i.file_size and i.file_size / max(1, i.compress_size) > MAX_RATIO):
                raise ValueError('archive member size/expansion bound exceeded')
            if name.lower().endswith(('.zip', '.7z', '.rar', '.tar', '.tgz', '.gz', '.bz2', '.xz')):
                raise ValueError('unexpected nested archive')
        before = signature(path.stat())
        digest_before = sha(path.read_bytes())
        members = []
        for i in sorted(infos, key=lambda i: i.filename):
            if not i.is_dir() and PurePosixPath(i.filename).suffix.lower() == '.md':
                data = z.read(i)
                members.append((i.filename, data, list(i.date_time)))
        if signature(path.stat()) != before or sha(path.read_bytes()) != digest_before:
            raise ValueError('archive changed while reading; pending recollection')
        return members, digest_before, {'members': len(infos), 'decompressed_bytes': sum(i.file_size for i in infos),
                                       'non_markdown_members_excluded': sum(not i.is_dir() and not i.filename.lower().endswith('.md') for i in infos)}


def categories(record):
    rel = record['original_path'].lower()
    result = []
    if PurePosixPath(rel).name in {'agents.md', 'claude.md', 'readme.md', 'architecture.md', 'lifeos_master_context.md', 'lifeos-ui-map.md', 'skill.md'} or 'architecture' in rel or 'overview' in rel:
        result.append(CATEGORIES[0])
    if any(x in rel for x in ['security', 'encryption', 'plaintext', 'keyring']):
        result.append(CATEGORIES[1])
    if any(x in rel for x in ['finance', 'loan', 'lender']):
        result.append(CATEGORIES[2])
    if any(x in rel for x in ['gtd', 'task', 'calendar', 'clarify', 'waiting']):
        result.append(CATEGORIES[3])
    if 'implementation' in rel:
        result.append(CATEGORIES[4])
    if any(x in rel for x in ['audit', 'discover']):
        result.append(CATEGORIES[5])
    if any(x in rel for x in ['plan', 'backlog', 'runbook', 'roadmap']):
        result.append(CATEGORIES[6])
    if any(x in rel for x in ['decision', 'owner-confirm', 'question']):
        result.append(CATEGORIES[7])
    if record['source_type'] == 'parallel':
        result.append(CATEGORIES[8])
    if record['source_type'] == 'archive':
        result.append(CATEGORIES[9])
    if record['source_type'] == 'design' or 'design-reference' in rel or 'handoff' in rel:
        result.append(CATEGORIES[10])
    return result or [CATEGORIES[-1]]


def relative_refs(text):
    # Markdown inline/reference-style links, HTML src/href, and explicit local paths in code spans.
    refs = []
    for m in re.finditer(r'!?\[[^\]\n]*\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)|^\s*\[[^\]]+\]:\s*(<[^>]+>|\S+)|(?:src|href)=[\"\x27]([^\"\x27]+)', text, re.M):
        value = next(v for v in m.groups() if v is not None).strip('<>')
        refs.append((value, 'link'))
    for m in re.finditer(r'`([^`\n]+)`', text):
        value = m.group(1)
        if re.fullmatch(r'[^\s]+\.(?:md|png|jpe?g|webp|svg|gif|mp4|mov|webm|csv|json|zip|pdf|docx|xlsx|py|jsx?|tsx?|css|html|woff2?|ttf)', value, re.I):
            refs.append((value, 'literal-path'))
    return sorted(set(refs))


def escape_label(value):
    return value.replace('|', '\\|').replace('[', '\\[').replace(']', '\\]').replace('\n', ' ')


def link(path):
    return urllib.parse.quote(path, safe='/')


def browse(repo, ref, path):
    return 'https://github.com/' + repo + '/blob/' + urllib.parse.quote(ref, safe='/') + '/' + link(path)


def build(config, destination, policy, dry_run=False):
    timestamp = dt.datetime.now(dt.timezone.utc).isoformat().replace('+00:00', 'Z')
    sources = []
    records = []
    payloads = {}
    issues = []
    run_checks = []
    candidates_by_source = {}
    baseline = config['baseline']
    baseline_root = Path(baseline['repository_path'])
    baseline_paths = [r.decode('utf-8') for r in git(baseline_root, 'ls-tree', '-r', '--name-only', '-z', baseline['sha']).split(b'\0') if r]
    baseline_hashes = {r: sha(git(baseline_root, 'show', baseline['sha'] + ':' + r)) for r in baseline_paths if eligible_repo_path(r)}
    for specification in sorted(config['sources'], key=lambda s: s['id']):
        source = dict(specification)
        root = Path(source['path'])
        source['branch'] = None
        source['head'] = None
        source['git_status_explanation'] = 'not applicable: non-Git folder/archive; no branch or commit invented'
        states, tracked = {}, set()
        if not root.exists():
            source['missing'] = True
            issues.append({'source_id': source['id'], 'reason': 'approved source absent'})
            sources.append(source)
            candidates_by_source[source['id']] = []
            continue
        source['missing'] = False
        if source['type'] == 'checkout':
            snapshot, states, tracked = checkout_state(root)
            source.update(snapshot)
            source['git_status_explanation'] = 'checkout HEAD plus working-tree/index status; documentation does not certify implementation completion'
            main_sha = config['origin_main_sha']
            ancestor = git(root, 'merge-base', '--is-ancestor', source['head'], baseline['sha'], check=False) is not None
            source['relation_to_baseline'] = ('pinned-baseline' if source['head'] == baseline['sha'] else 'ancestor-of-baseline' if ancestor else 'parallel-or-descendant-feature/report-branch')
            source['origin_main_is_ancestor'] = git(root, 'merge-base', '--is-ancestor', main_sha, source['head'], check=False) is not None
        else:
            source['relation_to_baseline'] = 'historical/archive' if source['type'] == 'archive' else 'design-reference/prototype' if source['type'] == 'design' else 'parallel planning/discovery; approval not inferred'
        if source['type'] == 'archive':
            try:
                raw, digest, details = archive_documents(root)
                source['archive_sha256'] = digest
                source['archive_safety'] = details
                candidates = [(rel, data, None, {'archive_sha256': digest, 'member_path': rel,
                               'metadata_date': date, 'metadata_date_explanation': 'ZIP metadata, no timezone/authorship proof',
                               'archive_relative_path': source.get('relative_path', root.name)}) for rel, data, date in raw]
            except (ValueError, OSError, zipfile.BadZipFile, RuntimeError) as exc:
                source['archive_error'] = str(exc)
                issues.append({'source_id': source['id'], 'reason': str(exc)})
                candidates = []
        else:
            paths, path_issues = walk_documents(root, source['type'])
            issues.extend({'source_id': source['id'], **v} for v in path_issues)
            candidates = [(rel, None, root / rel, None) for rel in paths]
        candidates_by_source[source['id']] = [c[0] for c in candidates]
        collision_groups = collections.defaultdict(list)
        for rel, _, _, _ in candidates:
            collision_groups[unicodedata.normalize('NFC', rel).casefold()].append(rel)
        for paths in collision_groups.values():
            if len(paths) > 1:
                issues.append({'source_id': source['id'], 'reason': 'case/Unicode collision; all safe distinct candidates retained', 'paths': paths})
        for rel, data, path, archive_meta in candidates:
            state = file_state(rel, source, states, tracked)
            record = {'source_id': source['id'], 'source_type': source['type'], 'source_path': str(root),
                      'original_path': rel, 'branch': source['branch'], 'head': source['head'],
                      'git_state': state, 'relation_to_baseline': source['relation_to_baseline'],
                      'publication_status': None, 'published_object': None, 'sha256': None, 'byte_length': None,
                      'archive': archive_meta, 'record_status': 'current-observation'}
            if unsafe_name(rel):
                record.update(publication_status='excluded', reason='unsafe path/name; no traversal permitted')
                records.append(record)
                continue
            if path is not None:
                data, disposition, snapshot = stable_read(path, root)
                if disposition:
                    record.update(publication_status=disposition, reason=snapshot)
                    records.append(record)
                    continue
            record['sha256'], record['byte_length'] = sha(data), len(data)
            if archive_meta:
                archive_meta['member_sha256'] = sha(data)
            if rel.startswith('__MACOSX/') or PurePosixPath(rel).name.startswith('._'):
                disposition, reason, flags = 'excluded', 'AppleDouble/resource-fork metadata; not authored Markdown', []
            else:
                disposition, reason, flags = review_content(data, source, rel, policy, config['visibility'])
            record['hygiene_review'] = reason
            record['recognized_pattern_categories'] = flags
            if disposition:
                # Withheld occurrence records expose only provenance/path/reason, never its content/hash.
                record.update(publication_status=disposition, reason=reason)
                if disposition == 'withheld':
                    record['sha256'] = None
                    record['byte_length'] = None
                    record['hygiene_review'] = reason
                    if record['archive']:
                        record['archive']['member_sha256'] = None
            else:
                payloads.setdefault(sha(data), {})[PurePosixPath(rel).name] = data
                record['publication_status'] = 'eligible'
                if path is not None:
                    run_checks.append({'source_id': source['id'], 'path': rel, 'stable_snapshot': snapshot})
                record['baseline_at_path'] = baseline_hashes.get(rel) == sha(data)
                record['categories'] = categories(record)
                name_lower = PurePosixPath(rel).name.lower()
                text_lower = data.decode('utf-8-sig').lower()
                record['completion_claim'] = ('draft/provisional/candidate; approval not inferred' if any(x in name_lower for x in ['draft', 'provisional', 'candidate', 'confirmable']) else 'reports completed implementation; ' + state['label'] + '; not independently certified' if 'implementations/' in rel.lower() and re.search(r'implemented|implementation report|verification|validation|реализован|реалізован', text_lower) else 'status unknown or historical; inspect document')
                record['semantic_status'] = ('candidate/provisional; no approval inferred' if any(x in name_lower for x in ['candidate', 'provisional', 'confirmable']) else 'recorded owner decisions; verify explicit approval and later context' if 'owner-decision' in name_lower else 'historical report claims; completion/testing not certified' if 'implementation' in rel.lower() else 'status unknown; inspect content and source code')
            records.append(record)
        # Git/index provenance must remain stable during the source's collection.
        if source['type'] == 'checkout':
            end, _, _ = checkout_state(root)
            if any(end[k] != source[k] for k in ['head', 'branch', 'status_sha256', 'index_sha256']):
                for record in records:
                    if record['source_id'] == source['id']:
                        record.update(publication_status='unstable/pending', published_object=None,
                                      reason='checkout HEAD/index/status changed during collection')
                issues.append({'source_id': source['id'], 'reason': 'checkout provenance changed; all its documents pending bounded refresh'})
        source['candidate_count'] = len(candidates)
        sources.append(source)
    # Preserve old distinct objects/occurrences on refresh. Never delete historical bytes.
    prior = json.loads((destination / 'manifest.json').read_text()) if (destination / 'manifest.json').exists() else None
    existing_objects = {o['sha256']: o for o in prior['objects']} if prior else {}
    for digest, names in sorted(payloads.items()):
        if not any(r['sha256'] == digest and r['publication_status'] == 'eligible' for r in records):
            continue
        if digest not in existing_objects:
            basename = sorted(names)[0]
            existing_objects[digest] = {'sha256': digest, 'byte_length': len(names[basename]),
                                        'path': 'documents/' + digest + '/' + basename}
    seen = set()
    for r in records:
        if r['publication_status'] == 'eligible':
            digest = r['sha256']
            r['published_object'] = existing_objects[digest]['path']
            r['publication_status'] = 'deduplicated' if digest in seen else 'published'
            seen.add(digest)
        r['occurrence_id'] = sha(json_bytes({k: r[k] for k in ['source_id', 'original_path', 'head', 'sha256', 'git_state', 'archive']}))
    current_ids = {r['occurrence_id'] for r in records}
    retained = []
    if prior:
        for r in prior['occurrences']:
            if r['occurrence_id'] not in current_ids and r.get('published_object'):
                r = dict(r, record_status='retained-prior-observation')
                retained.append(r)
    all_records = sorted(records + retained, key=lambda r: (r['source_id'], r['original_path'], r['occurrence_id']))
    by_source_path = {(r['source_id'], r['original_path']): r for r in records}
    source_lookup = {s['id']: s for s in sources}
    references = []
    for r in records:
        if not r.get('published_object'):
            continue
        text = payloads[r['sha256']][next(iter(payloads[r['sha256']]))].decode('utf-8-sig')
        for raw_ref, ref_type in relative_refs(text):
            parsed = urllib.parse.urlsplit(raw_ref)
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue
            decoded = urllib.parse.unquote(parsed.path)
            if decoded.startswith('/'):
                resolved = decoded
                status = 'absolute local path excluded/not portable'
                target = None
            else:
                resolved = posixpath.normpath(posixpath.join(posixpath.dirname(r['original_path']), decoded))
                target = by_source_path.get((r['source_id'], resolved))
                if target is None and ref_type == 'literal-path' and not decoded.startswith('../'):
                    target = by_source_path.get((r['source_id'], decoded))
                    if target:
                        resolved = decoded
                if target:
                    status = 'resolved via source-to-publication map' if target['published_object'] else target['publication_status']
                elif resolved.startswith('../'):
                    status = 'outside approved source root; not followed'
                elif r['source_type'] == 'archive':
                    status = 'archive attachment/non-collected member or missing path; excluded'
                else:
                    p = Path(r['source_path']) / resolved
                    if not p.resolve().is_relative_to(Path(r['source_path']).resolve()):
                        status = 'outside approved source root; not followed'
                    elif p.exists():
                        status = 'existing supporting attachment/application file deliberately excluded'
                    else:
                        status = 'missing relative target in source checkout'
            references.append({'occurrence_id': r['occurrence_id'], 'source_id': r['source_id'], 'original_path': r['original_path'],
                               'reference': raw_ref, 'reference_type': ref_type, 'resolved_source_path': resolved,
                               'status': status, 'published_target': target['published_object'] if target else None,
                               'fragment': parsed.fragment})
    path_versions = collections.defaultdict(set)
    for r in all_records:
        if r.get('published_object'):
            path_versions[r['original_path']].add(r['sha256'])
    conflicts = [{'original_path': path, 'sha256_versions': sorted(hashes)} for path, hashes in sorted(path_versions.items()) if len(hashes) > 1]
    eligible_records = [r for r in records if r.get('published_object')]
    coverage = []
    assigned = set()
    for s in sources:
        rs = [r for r in records if r['source_id'] == s['id']]
        hashes = {r['sha256'] for r in rs if r.get('published_object')}
        new = hashes - assigned
        coverage.append({'source_id': s['id'], 'type': s['type'], 'candidate_count': len(rs), 'published_distinct_versions_present': len(hashes),
                         'new_unique_objects': len(new), 'duplicate_occurrences': sum(bool(r.get('published_object')) for r in rs) - len(new),
                         'unstable_pending': sum(r['publication_status'] == 'unstable/pending' for r in rs),
                         'withheld': sum(r['publication_status'] == 'withheld' for r in rs),
                         'excluded': sum(r['publication_status'] == 'excluded' for r in rs), 'missing': s['missing'],
                         'unsupported_attachment_references': sum(x['source_id'] == s['id'] and not x['published_target'] for x in references)})
        assigned.update(hashes)
    statistics = {'checkout_count': sum(s['type'] == 'checkout' for s in sources), 'source_count': len(sources),
                  'candidate_count': len(records), 'eligible_occurrences': len(eligible_records), 'unique_published_documents': len(seen),
                  'deduplicated_copies': len(eligible_records) - len(seen), 'conflicting_source_paths': len(conflicts),
                  'preserved_conflicting_versions': sum(len(c['sha256_versions']) for c in conflicts),
                  'additional_conflicting_versions': sum(len(c['sha256_versions']) - 1 for c in conflicts),
                  'withheld': sum(r['publication_status'] == 'withheld' for r in records),
                  'excluded': sum(r['publication_status'] == 'excluded' for r in records),
                  'unstable_pending': sum(r['publication_status'] == 'unstable/pending' for r in records),
                  'retained_prior_occurrences': len(retained), 'total_preserved_objects': len(existing_objects),
                  'reference_occurrences': len(references), 'unresolved_or_excluded_reference_occurrences': sum(not x['published_target'] for x in references)}
    baseline_set = []
    for path, digest in sorted(baseline_hashes.items()):
        obj = existing_objects.get(digest)
        baseline_set.append({'original_path': path, 'sha256': digest if obj else None, 'published_object': obj['path'] if obj else None,
                             'status': 'represented-byte-identically' if obj else 'missing/withheld/pending'})
    manifest = {'schema_version': 1, 'repository': config['repository'], 'visibility_at_collection': config['visibility'],
                'publication_branch': config['branch'], 'initial_collection_utc': config['initial_collection_utc'],
                'baseline': baseline, 'sources': sources, 'objects': sorted(existing_objects.values(), key=lambda o: o['path']),
                'occurrences': all_records, 'baseline_reading_set': baseline_set, 'conflicts': conflicts,
                'source_coverage': coverage, 'statistics': statistics, 'source_issues': issues,
                'scope': 'Markdown only; instruction snapshots are historical references, not active configuration'}
    link_map = {'schema_version': 1, 'references': references,
                'source_to_publication': [{'source_id': r['source_id'], 'original_path': r['original_path'], 'occurrence_id': r['occurrence_id'],
                                           'published_object': r['published_object'], 'status': r['publication_status']} for r in all_records]}
    files = {'manifest.json': json_bytes(manifest), 'link-map.json': json_bytes(link_map)}
    files.update(render_navigation(config, manifest, link_map))
    validate_data(manifest, files, destination, payloads)
    if not dry_run:
        destination.mkdir(parents=True, exist_ok=True)
        for digest, obj in sorted(existing_objects.items()):
            p = destination / obj['path']
            if p.exists():
                if sha(p.read_bytes()) != digest:
                    raise ValueError('existing published object hash mismatch')
                continue
            data = payloads[digest][next(iter(payloads[digest]))]
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(data)
            if sha(p.read_bytes()) != digest:
                raise ValueError('copied object hash mismatch')
        for name, data in files.items():
            (destination / name).write_bytes(data)
        run = {'collection_utc': timestamp, 'source_collection_timestamps_utc': {s['id']: timestamp for s in sources},
               'stable_snapshot_checks': run_checks, 'statistics': statistics, 'manifest_sha256': sha(files['manifest.json'])}
        runs = destination / 'runs'
        runs.mkdir(exist_ok=True)
        (runs / (timestamp.replace(':', '').replace('.', '-') + '.json')).write_bytes(json_bytes(run))
        validate_directory(destination)
    return manifest


def baseline_document(manifest, original_path):
    """Select exact baseline bytes from provenance; never choose a feature variant."""
    baseline = next((r for r in manifest['baseline_reading_set']
                     if r['original_path'] == original_path), None)
    if not baseline or not baseline.get('published_object'):
        return None
    obj = next((o for o in manifest['objects'] if o['path'] == baseline['published_object']), None)
    if not obj or obj['sha256'] != baseline['sha256']:
        raise ValueError('baseline/object provenance mismatch: ' + original_path)
    if not any(r['original_path'] == original_path and r.get('published_object') == obj['path']
               and r['sha256'] == obj['sha256'] for r in manifest['occurrences']):
        raise ValueError('baseline has no source occurrence: ' + original_path)
    return baseline


def withholding_notice(manifest):
    notice = ('Withholding a duplicate snapshot means that no new copy is included in this collection. '
              'It does not remove pre-existing files elsewhere on the publication branch, files on '
              'other branches, or Git history. Existing exposure remains. No credential values are '
              'reproduced or tested, source reports changed, secrets rotated, visibility changed, or '
              'history rewritten by this documentation task.\n')
    withheld_paths = {r['original_path'] for r in manifest['occurrences']
                      if r['publication_status'] == 'withheld'}
    exposed = sorted(b['original_path'] for b in manifest['baseline_reading_set']
                     if b['original_path'] in withheld_paths and not b['published_object'])
    if exposed:
        notice += ('\nThe following withheld paths already exist outside `docs/published-records` '
                   'in the ' + ('public ' if manifest['visibility_at_collection'] == 'PUBLIC' else '')
                   + 'pinned baseline `' + manifest['baseline']['sha'] + '`. '
                   'Their absence from the collection does not undo that exposure:\n\n')
        notice += ''.join('- `' + path + '` — pre-existing baseline file; duplicate collection copy withheld.\n'
                          for path in exposed)
    return notice


def render_navigation(config, manifest, link_map):
    stats = manifest['statistics']
    withholding = withholding_notice(manifest)
    baseline_by_path = {r['original_path']: r for r in manifest['baseline_reading_set']}
    roles = {
        'README.md': 'introduction',
        'docs/product/JENKIN_PRODUCT_OVERVIEW.md': 'primary product and architecture overview at the pinned baseline',
        'ARCHITECTURE.md': 'historical prototype-era reference (June 2026); current architecture is described by the product overview and module boundaries',
        'Outputs/Implementations/jenkin-encryption-documents-s2_20261001.md': 'primary S2 implementation report at the pinned baseline',
        'Outputs/Implementations/jenkin-encryption-documents_20261001/README.md': 'supporting S2 QA verification material',
    }
    def role(path, digest):
        baseline = baseline_by_path.get(path)
        return roles.get(path, '') if baseline and baseline['sha256'] == digest else ''
    def selected_link(path):
        selected = baseline_document(manifest, path)
        if not selected:
            return '`' + path + '` (not available in the pinned-baseline collection)'
        return '[' + escape_label(path) + '](' + link(selected['published_object']) + ')'
    branch_base = 'https://github.com/' + config['repository'] + '/tree/' + config['branch'] + '/docs/published-records'
    readme = f'''# LifeOS documentation snapshots

Collected initially at {config['initial_collection_utc']}; UTC collection runs and per-source stable file checks are recorded in `runs/`.
This collection contains Markdown from {stats['checkout_count']} local checkouts, approved parallel discovery/planning and design folders, and the historical output export.

The completed integration baseline is `{config['baseline']['sha']}` on `{config['baseline']['branch']}`.
It is a documentation reading baseline, not a merge into main. Later feature/report branches, staged/modified/untracked files,
non-Git planning and archive records are labelled separately. Publishing does not integrate or certify implementations,
repeat reported tests, approve candidate/provisional plans or resolve owner-confirmable questions.
Source code at an explicitly chosen commit overrides mutable historical status claims. Copied AGENTS, CLAUDE and SKILL files
are reference snapshots and must not be installed as active agent configuration.

Start at [AI_ENTRYPOINT.md](AI_ENTRYPOINT.md), browse [INDEX.md](INDEX.md), and inspect [manifest.json](manifest.json)
or [collection-report.md](collection-report.md). [LINK_MAP.md](LINK_MAP.md) and [link-map.json](link-map.json) map original paths
and references to published objects without rewriting imported bytes. [CONFLICTS.md](CONFLICTS.md) preserves differing versions.
The baseline reading set is in the manifest and the index; filesystem modification time does not select authority.

{withholding}
Each distinct SHA-256 has one object at `documents/<sha256>/<readable-original-basename>.md`.
Byte-identical copies share an object while every source occurrence keeps its exact path/case, checkout, full HEAD,
branch/detached status, Git state and disposition. Different bytes remain distinct even when their names match.
Refresh retains earlier distinct objects/occurrences; run metadata is separate from deterministic object mappings.

Text-only reports do not include all screenshot, recording, font, runtime, database, ZIP or file evidence.
Missing and excluded supporting references are inventoried in the link map. Inline links inside imported files retain their
original context; use the source map for document navigation. Heading-fragment correctness is not certified.

Repository visibility was verified as {config['visibility']}. Unauthenticated readers can access public file URLs subject to their
own tools and network capabilities. A GitHub URL does not grant every AI access; private repositories require authorized access.

Branch browse: [collection]({branch_base}), [README]({browse(config['repository'], config['branch'], 'docs/published-records/README.md')}),
[INDEX]({browse(config['repository'], config['branch'], 'docs/published-records/INDEX.md')}),
[AI entry point]({browse(config['repository'], config['branch'], 'docs/published-records/AI_ENTRYPOINT.md')}),
[manifest]({browse(config['repository'], config['branch'], 'docs/published-records/manifest.json')}).
After commit publication, `PUBLICATION.md` supplies verified immutable commit links; a Git commit cannot embed its own SHA.

Collector and exact refresh instructions: [tool documentation](../../scripts/docs/README.md).
'''
    rs = [r for r in manifest['occurrences'] if r.get('published_object')]
    # One entry per object/path/version, with all source statuses shown alongside it.
    groups = collections.defaultdict(list)
    for r in rs:
        groups[(r['original_path'], r['sha256'])].append(r)
    def entry(path, digest, records):
        obj = records[0]['published_object']
        provenance = '; '.join(escape_label(r['source_id']) + ' — ' + r['git_state']['label'] + ' — ' + r['relation_to_baseline'] + ('; retained prior observation' if r['record_status'] != 'current-observation' else '') for r in records)
        role_label = role(path, digest)
        role_note = ' · ' + role_label if role_label else ''
        return f'- [{escape_label(path)}]({link(obj)}) · `{digest[:12]}`{role_note} · {provenance}\n'
    index = '# Documentation index\n\nAll imported instruction files are reference snapshots. Status describes the document snapshot, not implementation certification.\n\n## Pinned baseline reading set\n\n'
    index += ('Primary product reading: ' + selected_link('docs/product/JENKIN_PRODUCT_OVERVIEW.md')
              + '. README is an introduction; ARCHITECTURE.md is a historical prototype-era reference.\n\n')
    for b in manifest['baseline_reading_set']:
        if b['published_object']:
            role_note = ' · ' + role(b['original_path'], b['sha256']) if role(b['original_path'], b['sha256']) else ''
            index += f'- [{escape_label(b["original_path"])}]({link(b["published_object"])}) · pinned baseline `{config["baseline"]["sha"]}`{role_note}\n'
        else:
            index += f'- {escape_label(b["original_path"])} — {b["status"]}\n'
    for cat in CATEGORIES:
        index += '\n## ' + cat + '\n\n'
        for (path, digest), records in sorted(groups.items()):
            if any(cat in r.get('categories', []) for r in records):
                index += entry(path, digest, records)
    index += '\n## Withheld, excluded and pending\n\n' + withholding + '\nSee [collection-report.md](collection-report.md) for every non-published disposition.\n'
    ai = '# Fresh-agent reading order\n\nApplication baseline: `' + config['baseline']['sha'] + '` (`' + config['baseline']['branch'] + '`).\nChoose the code revision explicitly; source code at that commit overrides mutable claims in historical documents.\nPublishing these snapshots does not merge implementations or certify reported completion.\n\n'
    read_order = [('Governing instructions (reference snapshots)', ['AGENTS.md', 'CLAUDE.md']),
                  ('Introduction', ['README.md']),
                  ('Primary product and architecture overview at the pinned baseline', ['docs/product/JENKIN_PRODUCT_OVERVIEW.md']),
                  ('Baseline master context', ['LIFEOS_MASTER_CONTEXT.md']),
                  ('Current module boundaries at the pinned baseline', ['Outputs/architecture/module-boundaries.md'])]
    for i, (title, paths) in enumerate(read_order, 1):
        ai += str(i) + '. ' + title + ': ' + ', '.join(selected_link(p) for p in paths) + '.\n'
    s2_report = 'Outputs/Implementations/jenkin-encryption-documents-s2_20261001.md'
    s2_qa = 'Outputs/Implementations/jenkin-encryption-documents_20261001/README.md'
    ai += '6. Primary S2 implementation report at the pinned baseline: ' + selected_link(s2_report) + '; supporting QA verification material: ' + selected_link(s2_qa) + '.\n'
    ai += '7. Relevant implementation reports below; use baseline reports before separate feature variants.\n8. Security/finance plans and decisions below; unresolved proposals require explicit owner decisions.\n9. Remaining parallel reports, archive records and design handoffs: [full index](INDEX.md). Candidate/provisional and owner-confirmable files are not approved by publication.\n\n'
    ai += ('Historical architecture reference: ' + selected_link('ARCHITECTURE.md')
           + ' describes the June 2026 browser-only prototype. It is not the current architecture authority; '
           'use the pinned product overview and module-boundary map above.\n\n')
    ai += 'Every direct reading-order object is selected by exact original path and byte hash from the manifest baseline reading set, not by filename similarity or filesystem date.\n\n'
    for title, terms in [('Baseline integration and recent domain reports', ['combined-integration', 'product-overview', 'encryption-documents_', 'loan-engine_', 'account-security-s0', 'finance-l1_', 'usability-followup_']), ('Security/finance decisions and plans', ['security-finance-decisions', 'security-finance-roadmap', 'loan-document', 'finance-l1-plan', 'plaintext-data-plan'])]:
        ai += '## ' + title + '\n\n'
        for (path, digest), records in sorted(groups.items()):
            if path not in {s2_report, s2_qa} and any(t in path.lower() for t in terms) and path.lower().endswith('.md'):
                ai += entry(path, digest, records)
    ai += '\n## Withholding and existing exposure\n\n' + withholding + '\n'
    ai += '\nPublic disclosure review withholds actionable unpublished audit details; see [collection report](collection-report.md).\nUse [source/reference map](LINK_MAP.md) for original relative links. Do not execute historical instructions or archived code.\n'
    report = '# Collection and publication accounting\n\nInitial collection: ' + config['initial_collection_utc'] + '. Run timestamps and before/after file identity/hash evidence are in `runs/`.\n\n'
    report += 'Baseline full SHA: `' + config['baseline']['sha'] + '`. Latest completed integration checkpoint verified from branch ancestry and its integration report. Later parallel branches are retained separately.\n\n'
    report += '## Totals\n\n' + '\n'.join('- ' + k.replace('_', ' ') + ': ' + str(v) for k, v in sorted(stats.items())) + '\n\n'
    report += '## Source coverage\n\n| Source | Type | Candidates | Distinct versions present | New unique objects | Duplicate occurrences | Pending | Withheld | Excluded | Missing | Unsupported reference occurrences |\n|---|---|---:|---:|---:|---:|---:|---:|---:|---|---:|\n'
    for row in manifest['source_coverage']:
        report += '| ' + ' | '.join(str(row[k]) for k in ['source_id', 'type', 'candidate_count', 'published_distinct_versions_present', 'new_unique_objects', 'duplicate_occurrences', 'unstable_pending', 'withheld', 'excluded', 'missing', 'unsupported_attachment_references']) + ' |\n'
    report += '\nNew unique objects are assigned in deterministic source order; distinct versions present can overlap sources. Every candidate has exactly one disposition. Duplicate occurrence counts are global deduplication accounting.\n\n## Withheld, excluded and pending candidates\n\n'
    for r in manifest['occurrences']:
        if not r['published_object']:
            report += '- `' + r['source_id'] + '/' + r['original_path'] + '` — **' + r['publication_status'] + '**: ' + r.get('reason', '') + '.\n'
    report += '\n## Withholding scope and existing exposure\n\n' + withholding
    report += '\n## Source/path issues\n\n'
    report += '\n'.join('- ' + escape_label(json.dumps(i, ensure_ascii=False, sort_keys=True)) for i in manifest['source_issues']) or 'None detected.'
    report += '\n\n## Hygiene and limitations\n\nAll eligible bytes were scanned before staging using bounded secret/private-key/DSN/account/financial/health pattern recognizers and hash-bound manual review of matches. Technical examples, synthetic QA records and documented paths are not automatically secrets. No sensitive values are logged. Newly flagged bytes remain withheld until reviewed; reviewed hashes never override explicit withheld-path decisions. Unpublished actionable security reports are withheld for owner disclosure review in this public repository.\n\nArchive central-directory checks precede reads: 2000-member, 64 MiB total, 16 MiB/member, 100:1 expansion bounds; no absolute/traversal/symlink/encrypted/nested-archive entries; read directly without extraction or execution. ZIP dates are metadata, not authorship proof. AppleDouble files are accounted for and excluded. Other ZIPs, assets, screenshots, runtimes, fonts, mail, databases and dumps were not imported.\n\nEvery copied object is hash-checked against a stable double-read snapshot. Manifest provenance, object completeness, deterministic ordering and generated local links are validated by the collector. Relative-reference parsing covers Markdown links, reference definitions, HTML src/href and explicit extension-bearing code paths; arbitrary prose references and heading fragments may need human interpretation. Missing/excluded attachment references are detailed in [LINK_MAP.md](LINK_MAP.md). Application suites were not run for this isolated documentation task.\n'
    lm = '# Source-to-publication reference map\n\nImported bytes are unchanged. Find the originating source/path in [manifest.json](manifest.json) and use the matching target here. References to application code and supporting media are outside the text-only collection. Fragments are recorded but not individually certified.\n\n## Source document map\n\n'
    for (path, digest), records in sorted(groups.items()):
        lm += entry(path, digest, records)
    lm += '\n## Unresolved/excluded supporting references\n\n'
    ref_groups = collections.defaultdict(list)
    for ref in link_map['references']:
        if not ref['published_target']:
            ref_groups[(ref['original_path'], ref['reference'], ref['status'])].append(ref['source_id'])
    for (path, ref, status), ids in sorted(ref_groups.items()):
        lm += '- `' + escape_label(path) + '` → `' + escape_label(ref) + '` — ' + status + '; sources: ' + ', '.join(sorted(set(ids))) + '.\n'
    lm += '\nMachine-readable resolved mappings and original fragment strings: [link-map.json](link-map.json).\n'
    conflicts = '# Distinct versions at matching original paths\n\nDifferent bytes are preserved. No authority is inferred from filesystem mtime. Original path case is exact.\n\n'
    for c in manifest['conflicts']:
        conflicts += '## ' + escape_label(c['original_path']) + '\n\n'
        for digest in c['sha256_versions']:
            conflicts += entry(c['original_path'], digest, groups[(c['original_path'], digest)])
        conflicts += '\n'
    return {k: (v.rstrip() + '\n').encode('utf-8') for k, v in {'README.md': readme, 'INDEX.md': index, 'AI_ENTRYPOINT.md': ai,
             'collection-report.md': report, 'LINK_MAP.md': lm, 'CONFLICTS.md': conflicts}.items()}


def validate_data(manifest, files, destination, payloads):
    if manifest['schema_version'] != 1:
        raise ValueError('unsupported manifest schema')
    objects = {o['path']: o for o in manifest['objects']}
    ids = set()
    for r in manifest['occurrences']:
        if r['publication_status'] not in DISPOSITIONS or r['occurrence_id'] in ids:
            raise ValueError('invalid/duplicate occurrence disposition')
        ids.add(r['occurrence_id'])
        if r['source_type'] != 'checkout' and (r['head'] or r['branch']):
            raise ValueError('invented non-Git provenance')
        if r['published_object']:
            obj = objects[r['published_object']]
            if obj['sha256'] != r['sha256'] or obj['byte_length'] != r['byte_length']:
                raise ValueError('occurrence/object mismatch')
    for obj in objects.values():
        if unsafe_name(obj['path']) or not obj['path'].startswith('documents/' + obj['sha256'] + '/'):
            raise ValueError('unsafe content address')
        data = next(iter(payloads.get(obj['sha256'], {}).values()), None)
        if data is None:
            data = (destination / obj['path']).read_bytes()
        if sha(data) != obj['sha256'] or len(data) != obj['byte_length']:
            raise ValueError('document byte/hash mismatch')
    for name, data in files.items():
        if not name.endswith('.md'):
            continue
        for ref, ref_type in relative_refs(data.decode()):
            if ref_type == 'literal-path':
                continue
            parsed = urllib.parse.urlsplit(ref)
            if parsed.scheme or not parsed.path:
                continue
            path = urllib.parse.unquote(parsed.path)
            if path.startswith('../../scripts/docs/'):
                continue  # Cross-collection tooling docs verified by repository check.
            if path not in objects and path not in files:
                raise ValueError('broken generated local link in ' + name + ': ' + path)


def validate_directory(destination):
    manifest = json.loads((destination / 'manifest.json').read_text())
    files = {p.name: p.read_bytes() for p in destination.iterdir() if p.is_file() and p.name in {'README.md', 'INDEX.md', 'AI_ENTRYPOINT.md', 'collection-report.md', 'LINK_MAP.md', 'CONFLICTS.md', 'manifest.json', 'link-map.json'}}
    validate_data(manifest, files, destination, {})
    return manifest['statistics']


def regenerate_navigation(destination, dry_run=False):
    """Refresh navigation from published provenance without reading source roots."""
    manifest_bytes = (destination / 'manifest.json').read_bytes()
    link_map_bytes = (destination / 'link-map.json').read_bytes()
    manifest = json.loads(manifest_bytes)
    link_map = json.loads(link_map_bytes)
    config = {'repository': manifest['repository'], 'branch': manifest['publication_branch'],
              'visibility': manifest['visibility_at_collection'], 'baseline': manifest['baseline'],
              'initial_collection_utc': manifest['initial_collection_utc']}
    files = render_navigation(config, manifest, link_map)
    validate_data(manifest, dict(files, **{'manifest.json': manifest_bytes, 'link-map.json': link_map_bytes}),
                  destination, {})
    changed = []
    for name, data in sorted(files.items()):
        path = destination / name
        if not path.exists() or path.read_bytes() != data:
            changed.append(name)
            if not dry_run:
                path.write_bytes(data)
    if not dry_run:
        validate_directory(destination)
    return changed


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', type=Path)
    parser.add_argument('--source-root', action='append', type=Path, default=[], help='Additional explicit source folder (auto detects checkout)')
    parser.add_argument('--destination', type=Path, required=True)
    parser.add_argument('--policy', type=Path)
    parser.add_argument('--dry-run', action='store_true')
    actions = parser.add_mutually_exclusive_group()
    actions.add_argument('--verify', action='store_true')
    actions.add_argument('--regenerate-navigation', action='store_true', help='Regenerate from the existing manifest; do not recollect sources')
    args = parser.parse_args()
    if args.verify:
        print(json.dumps(validate_directory(args.destination), sort_keys=True))
        return
    if args.regenerate_navigation:
        changed = regenerate_navigation(args.destination, args.dry_run)
        print(json.dumps({'dry_run': args.dry_run, 'navigation_changed': changed}, sort_keys=True))
        return
    if not args.config or not args.policy:
        parser.error('--config and --policy required for collection')
    config = json.loads(args.config.read_text())
    for root in args.source_root:
        config['sources'].append({'id': root.name, 'path': str(root.absolute()), 'type': 'checkout' if (root / '.git').exists() else 'parallel'})
    ids = [s['id'] for s in config['sources']]
    if len(ids) != len(set(ids)):
        parser.error('source identifiers must be unique')
    for source in config['sources']:
        if Path(source['path']).resolve() == args.destination.resolve() or (source['type'] != 'archive' and Path(source['path']).resolve().is_relative_to(args.destination.resolve())):
            parser.error('destination cannot be ingested as a source')
    manifest = build(config, args.destination, json.loads(args.policy.read_text()), args.dry_run)
    print(json.dumps({'dry_run': args.dry_run, **manifest['statistics']}, sort_keys=True))


if __name__ == '__main__':
    main()
