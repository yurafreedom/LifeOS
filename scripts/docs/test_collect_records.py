"""Fixture-based integrity/safety tests; no application infrastructure required."""
import importlib.util
import json
import os
from pathlib import Path
import stat
import subprocess
import tempfile
import unittest
from unittest import mock
import zipfile

spec = importlib.util.spec_from_file_location('collector', Path(__file__).with_name('collect-records.py'))
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)


class CollectorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.repo = self.root / 'repo'
        self.repo.mkdir()
        def g(*args):
            return subprocess.run(['git', '-C', str(self.repo), *args], check=True, capture_output=True).stdout
        self.g = g
        g('init', '-q')
        g('config', 'user.email', 'fixture@example.com')
        g('config', 'user.name', 'Fixture')
        (self.repo / 'Outputs').mkdir()
        (self.repo / 'README.md').write_bytes(b'# Overview\n')
        (self.repo / 'Outputs' / 'report.md').write_bytes(b'# Report\n\n[Overview](../README.md)\n')
        g('add', 'README.md', 'Outputs')
        g('commit', '-qm', 'fixture')
        self.head = g('rev-parse', 'HEAD').decode().strip()
        self.config = {'repository': 'example/fixture', 'visibility': 'PUBLIC', 'branch': 'docs/fixture',
                       'initial_collection_utc': '2026-10-02T00:00:00Z', 'origin_main_sha': self.head,
                       'baseline': {'sha': self.head, 'branch': 'fixture', 'repository_path': str(self.repo)},
                       'sources': [{'id': 'repo', 'path': str(self.repo), 'type': 'checkout'}]}
        self.policy = {'reviewed_sha256': {}, 'withheld': []}
        self.dest = self.root / 'collection'

    def tearDown(self):
        self.temp.cleanup()

    def build(self, dry=False):
        return c.build(self.config, self.dest, self.policy, dry)

    def test_dedup_conflicts_provenance_and_repeatability(self):
        folder = self.root / 'parallel'
        folder.mkdir()
        (folder / 'README.md').write_bytes(b'# Different overview\n')
        (folder / 'same.md').write_bytes(b'# Overview\n')
        self.config['sources'].append({'id': 'parallel', 'path': str(folder), 'type': 'parallel'})
        before_index = c.checkout_state(self.repo)[0]['index_sha256']
        first = self.build()
        bytes_first = (self.dest / 'manifest.json').read_bytes()
        objects_first = {o['path']: (self.dest / o['path']).read_bytes() for o in first['objects']}
        second = self.build()
        self.assertEqual(bytes_first, (self.dest / 'manifest.json').read_bytes())
        self.assertEqual(first['occurrences'], second['occurrences'])
        self.assertEqual(first['statistics']['unique_published_documents'], 3)
        self.assertEqual(first['statistics']['deduplicated_copies'], 1)
        self.assertEqual(first['statistics']['conflicting_source_paths'], 1)
        self.assertEqual(c.checkout_state(self.repo)[0]['index_sha256'], before_index)
        for path, data in objects_first.items():
            self.assertEqual(data, (self.dest / path).read_bytes())
        (folder / 'README.md').write_bytes(b'# Third overview\n')
        third = self.build()
        self.assertEqual(third['statistics']['total_preserved_objects'], 4)
        self.assertEqual(third['statistics']['retained_prior_occurrences'], 1)
        self.assertTrue(all((self.dest / p).exists() for p in objects_first))
        self.assertFalse(any(r['head'] for r in third['occurrences'] if r['source_type'] != 'checkout'))

    def test_staged_modified_untracked_and_self_exclusion(self):
        (self.repo / 'new.md').write_bytes(b'# Staged\n')
        self.g('add', 'new.md')
        (self.repo / 'new.md').write_bytes(b'# Modified after staging\n')
        (self.repo / 'untracked.md').write_bytes(b'# Untracked\n')
        own = self.repo / 'docs' / 'published-records'
        own.mkdir(parents=True)
        (own / 'self.md').write_bytes(b'# Do not ingest\n')
        m = self.build()
        rows = {r['original_path']: r for r in m['occurrences']}
        self.assertTrue(rows['new.md']['git_state']['staged'])
        self.assertTrue(rows['new.md']['git_state']['modified'])
        self.assertTrue(rows['untracked.md']['git_state']['untracked'])
        self.assertNotIn('docs/published-records/self.md', rows)

    def test_dry_run_and_hygiene_withhold_without_content(self):
        (self.repo / 'private.md').write_text('# Private\npassword = "randomfixturecredential"\n')
        m = self.build(True)
        self.assertFalse(self.dest.exists())
        r = next(r for r in m['occurrences'] if r['original_path'] == 'private.md')
        self.assertEqual(r['publication_status'], 'withheld')
        self.assertIsNone(r['sha256'])
        self.assertNotIn('randomfixturecredential', json.dumps(m))

    def test_stable_read_retry_and_external_symlink(self):
        path = self.repo / 'README.md'
        real = Path.read_bytes
        calls = 0
        def changing(p):
            nonlocal calls
            b = real(p)
            if p == path:
                calls += 1
                p.write_bytes(b + b'x')
            return b
        with mock.patch.object(Path, 'read_bytes', changing):
            data, disposition, _ = c.stable_read(path, self.repo)
        self.assertIsNone(data)
        self.assertEqual(disposition, 'unstable/pending')
        self.assertEqual(calls, 6)
        target = self.root / 'outside.md'
        target.write_bytes(b'private')
        symlink = self.repo / 'alias.md'
        symlink.symlink_to(target)
        self.assertEqual(c.stable_read(symlink, self.repo)[1], 'excluded')

    def test_link_resolution_and_object_tampering(self):
        m = self.build()
        lm = json.loads((self.dest / 'link-map.json').read_text())
        self.assertEqual(lm['references'][0]['status'], 'resolved via source-to-publication map')
        self.assertTrue(lm['references'][0]['published_target'])
        path = self.dest / m['objects'][0]['path']
        path.write_bytes(b'tampered')
        with self.assertRaises(ValueError):
            c.validate_directory(self.dest)

    def test_primary_reading_uses_pinned_provenance_and_labels_support(self):
        paths = {
            'docs/product/JENKIN_PRODUCT_OVERVIEW.md': b'# Baseline product overview\n',
            'ARCHITECTURE.md': b'# Architecture\nHistorical prototype era, June 2026.\n',
            'Outputs/Implementations/jenkin-encryption-documents-s2_20261001.md': b'# Primary S2 report\n',
            'Outputs/Implementations/jenkin-encryption-documents_20261001/README.md': b'# S2 QA supporting material\n',
        }
        for path, data in paths.items():
            p = self.repo / path
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(data)
        self.g('add', '.')
        self.g('commit', '-qm', 'baseline reading documents')
        self.head = self.g('rev-parse', 'HEAD').decode().strip()
        self.config['baseline']['sha'] = self.head
        self.config['origin_main_sha'] = self.head
        parallel = self.root / 'parallel'
        for path in paths:
            p = parallel / path
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_bytes(b'# Different feature variant\n')
        self.config['sources'].append({'id': 'parallel', 'path': str(parallel), 'type': 'parallel'})
        m = self.build()
        ai = (self.dest / 'AI_ENTRYPOINT.md').read_text()
        for path, data in paths.items():
            selected = c.baseline_document(m, path)
            self.assertEqual(selected['sha256'], c.sha(data))
            self.assertIn('](' + selected['published_object'] + ')', ai)
        overview = c.baseline_document(m, 'docs/product/JENKIN_PRODUCT_OVERVIEW.md')
        s2 = c.baseline_document(m, 'Outputs/Implementations/jenkin-encryption-documents-s2_20261001.md')
        self.assertIn('3. Primary product and architecture overview at the pinned baseline:', ai)
        self.assertIn('6. Primary S2 implementation report at the pinned baseline:', ai)
        self.assertIn('2. Introduction: [README.md]', ai)
        self.assertIn('supporting QA verification material:', ai)
        self.assertIn('June 2026 browser-only prototype. It is not the current architecture authority', ai)
        self.assertIn('Historical architecture reference:', ai)
        index = (self.dest / 'INDEX.md').read_text()
        self.assertIn('historical prototype-era reference (June 2026)', index)
        # If baseline provenance becomes unavailable, never silently select a feature copy.
        unavailable = json.loads(json.dumps(m))
        for b in unavailable['baseline_reading_set']:
            if b['original_path'] == 'docs/product/JENKIN_PRODUCT_OVERVIEW.md':
                b['published_object'] = None
        self.assertIsNone(c.baseline_document(unavailable, 'docs/product/JENKIN_PRODUCT_OVERVIEW.md'))
        # A manifest pointer to unrelated bytes must be rejected before rendering.
        corrupt = json.loads(json.dumps(m))
        for b in corrupt['baseline_reading_set']:
            if b['original_path'] == 'docs/product/JENKIN_PRODUCT_OVERVIEW.md':
                b['published_object'] = s2['published_object']
        with self.assertRaises(ValueError):
            c.render_navigation(self.config, corrupt, json.loads((self.dest / 'link-map.json').read_text()))

    def test_withholding_notice_records_existing_exposure_without_values(self):
        path = 'Outputs/Plans/existing.md'
        p = self.repo / path
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text('# Withheld record\n')
        self.g('add', path)
        self.g('commit', '-qm', 'pre-existing record')
        self.head = self.g('rev-parse', 'HEAD').decode().strip()
        self.config['baseline']['sha'] = self.head
        self.config['origin_main_sha'] = self.head
        self.policy['withheld'].append({'source_id': 'repo', 'path': path,
                                      'reason': 'pending owner credential classification'})
        self.build()
        for name in ['README.md', 'AI_ENTRYPOINT.md', 'INDEX.md', 'collection-report.md']:
            text = (self.dest / name).read_text()
            self.assertIn('It does not remove pre-existing files elsewhere on the publication branch', text)
            self.assertIn('other branches, or Git history', text)
            self.assertIn('`' + path + '` — pre-existing baseline file', text)
        self.assertTrue(p.exists())
        self.assertEqual(p.read_text(), '# Withheld record\n')

    def test_navigation_regeneration_is_repeatable_without_recollecting_sources(self):
        m = self.build()
        manifest_bytes = (self.dest / 'manifest.json').read_bytes()
        link_bytes = (self.dest / 'link-map.json').read_bytes()
        object_bytes = {o['path']: (self.dest / o['path']).read_bytes() for o in m['objects']}
        runs = sorted(p.name for p in (self.dest / 'runs').iterdir())
        (self.dest / 'AI_ENTRYPOINT.md').write_text('# Outdated navigation\n')
        with mock.patch.object(c, 'git', side_effect=AssertionError('must not inspect source Git state')):
            changed = c.regenerate_navigation(self.dest, dry_run=True)
            self.assertEqual(changed, ['AI_ENTRYPOINT.md'])
            self.assertEqual((self.dest / 'AI_ENTRYPOINT.md').read_text(), '# Outdated navigation\n')
            self.assertEqual(c.regenerate_navigation(self.dest), ['AI_ENTRYPOINT.md'])
            self.assertEqual(c.regenerate_navigation(self.dest), [])
        self.assertEqual(manifest_bytes, (self.dest / 'manifest.json').read_bytes())
        self.assertEqual(link_bytes, (self.dest / 'link-map.json').read_bytes())
        self.assertEqual(runs, sorted(p.name for p in (self.dest / 'runs').iterdir()))
        for path, data in object_bytes.items():
            self.assertEqual(data, (self.dest / path).read_bytes())

    def archive(self, members):
        path = self.root / 'test.zip'
        with zipfile.ZipFile(path, 'w') as z:
            for name, data in members:
                z.writestr(name, data)
        return path

    def test_archive_member_mapping_metadata_and_resource_forks(self):
        path = self.archive([('outputs/old.md', b'# Overview\n'), ('__MACOSX/._old.md', b'\0binary'), ('asset.png', b'image')])
        self.config['sources'].append({'id': 'archive', 'path': str(path), 'type': 'archive'})
        m = self.build()
        rows = [r for r in m['occurrences'] if r['source_id'] == 'archive']
        self.assertEqual(len(rows), 2)
        self.assertEqual(sum(r['publication_status'] == 'excluded' for r in rows), 1)
        document = next(r for r in rows if r['published_object'])
        self.assertIsNone(document['head'])
        self.assertEqual(document['archive']['member_sha256'], document['sha256'])
        self.assertEqual(len(document['archive']['metadata_date']), 6)

    def test_reject_archive_paths_symlinks_nested_and_bounds_before_reads(self):
        for bad_name in ['/absolute.md', '../escape.md', 'a/../../escape.md', 'C:/escape.md', 'a\\escape.md', 'nested.zip']:
            with self.subTest(name=bad_name):
                path = self.archive([(bad_name, b'x')])
                with mock.patch.object(zipfile.ZipFile, 'read', side_effect=AssertionError('must reject before reads')):
                    with self.assertRaises(ValueError):
                        c.archive_documents(path)
        path = self.root / 'symlink.zip'
        with zipfile.ZipFile(path, 'w') as z:
            info = zipfile.ZipInfo('link.md')
            info.create_system = 3
            info.external_attr = (stat.S_IFLNK | 0o777) << 16
            z.writestr(info, 'target')
        with self.assertRaises(ValueError):
            c.archive_documents(path)
        path = self.archive([('one.md', b'one'), ('two.md', b'two')])
        with mock.patch.object(c, 'MAX_MEMBERS', 1), self.assertRaises(ValueError):
            c.archive_documents(path)
        with mock.patch.object(c, 'MAX_ARCHIVE_TOTAL', 1), self.assertRaises(ValueError):
            c.archive_documents(path)


if __name__ == '__main__':
    unittest.main()
