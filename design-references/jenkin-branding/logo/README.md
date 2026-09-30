# JENKIN — initial logo directions

01 Editorial: Latin Modern Roman 17 Regular, optical spacing adjusted for this wordmark. Recommended direction; related to the expressive serif character of the IRIS reference, without claiming an exact font match.
02 Satin: Nimbus Sans Bold, tight spacing. Practical alternative for the current UI.
03 Modular: original geometric stroke construction. No font dependency.

Each direction includes light and dark transparent SVG and PNG, plus currentColor SVG for inline use. PNG exports are 1440 × 320. SVG lettering is outlined: no web font download required. Light files are for dark surfaces; dark files are for light surfaces.

The icon is an exploratory serif J with a small amber point, not a final approved brand symbol. CSS is optional and applies to inline currentColor SVG; an SVG loaded via img will not inherit the page color.

Use Editorial as a logo while retaining existing sans-serif interface text. Avoid permanent glow, metallic gradients at sidebar sizes, or continuous animation. The supplied CSS gives a slight hover-only glow and visible keyboard focus.

Suggested accessible implementation: wrap the SVG in the existing home link, give the link aria-label="JENKIN — Home", and hide redundant SVG announcement when the link supplies the name.

These are initial design directions, not an implemented rebrand. No repository files were changed.

Font credits: Latin Modern by B. Jackowski and J. M. Nowacki (GUST Font License); Nimbus Sans by URW (distributed in URW Base35, AGPL with font embedding exception). See FONT-NOTICES.txt for installed font metadata. Keep credits when distributing these studies.
