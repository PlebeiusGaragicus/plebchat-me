// VENDOR STUB — upstream pdf.js pulls in a ~13 MB pdfjs build. PDF support
// is a deferred phase with its own design (docs/proposals/read-mode.md,
// Phase 9); until then PDFs are rejected at import.
export const makePDF = async () => {
	throw new Error('PDF files are not supported yet');
};
