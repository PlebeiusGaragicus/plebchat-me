// Minimal generated EPUB3 for e2e tests — no binaries in git, deterministic
// chapter text for selection assertions. The `mimetype` entry must be the
// first, STORE'd (uncompressed) zip entry per the EPUB OCF spec; epub.js
// accepts these files (validated when this builder was prototyped).
import JSZip from 'jszip';

export const CH1_TEXT = 'Alpha fixture text begins the narrative arc of chapter one.';
export const CH2_TEXT = 'Bravo fixture text continues in chapter two with distinct words.';
export const CH3_TEXT = 'Charlie fixture text concludes matters in chapter three.';

function xhtml(num: number, body: string): string {
	return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>Chapter ${num}</title></head>
<body><h1>Chapter ${num}</h1>${body}</body>
</html>`;
}

export interface EpubFixtureOptions {
	title?: string;
	/** Varies the identifier + text so two fixtures get different sha256s. */
	seed?: string;
}

export async function buildEpub({ title = 'Fixture Book', seed = '1' }: EpubFixtureOptions = {}): Promise<Buffer> {
	const chapters = [
		xhtml(1, `<p>${CH1_TEXT} (seed ${seed})</p>` + '<p>Padding prose to force several pages.</p>'.repeat(30)),
		xhtml(2, `<p>${CH2_TEXT}</p>` + '<p>More padding follows here to force pages.</p>'.repeat(30)),
		xhtml(3, `<p>${CH3_TEXT}</p>` + '<p>Final stretch of filler prose lives here.</p>'.repeat(30))
	];

	const zip = new JSZip();
	zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
	zip.file(
		'META-INF/container.xml',
		`<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`
	);
	zip.file(
		'OEBPS/content.opf',
		`<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:isbn:978000000000${seed}</dc:identifier>
    <dc:title>${title}</dc:title>
    <dc:creator>Fixture Author</dc:creator>
    <dc:language>en</dc:language>
    <dc:description>A tiny generated book for e2e tests (seed ${seed}).</dc:description>
    <meta property="dcterms:modified">2026-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
    <item id="ch3" href="ch3.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/><itemref idref="ch2"/><itemref idref="ch3"/>
  </spine>
</package>`
	);
	zip.file(
		'OEBPS/nav.xhtml',
		`<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Contents</title></head>
<body>
  <nav epub:type="toc"><ol>
    <li><a href="ch1.xhtml">Chapter 1</a></li>
    <li><a href="ch2.xhtml">Chapter 2</a></li>
    <li><a href="ch3.xhtml">Chapter 3</a></li>
  </ol></nav>
</body>
</html>`
	);
	zip.file('OEBPS/ch1.xhtml', chapters[0]);
	zip.file('OEBPS/ch2.xhtml', chapters[1]);
	zip.file('OEBPS/ch3.xhtml', chapters[2]);
	return zip.generateAsync({ type: 'nodebuffer', mimeType: 'application/epub+zip' });
}
