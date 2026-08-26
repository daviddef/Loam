# Vendored: zxing-wasm (reader)

Powers barcode scanning (camera + photo) on browsers without the native
`BarcodeDetector` API — every browser on iOS, Chrome included, since Apple
requires all of them to run its WebKit engine, which has never implemented it.

- Package: [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) — a WebAssembly
  build of the [ZXing-C++](https://github.com/zxing-cpp/zxing-cpp) barcode
  reader/writer library.
- Version: 3.1.3, reader-only IIFE build (no writer, no non-1D formats needed).
- Retrieved: 2026-08-26, from jsDelivr
  (`https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.3/dist/iife/reader/index.js`
  and `.../dist/reader/zxing_reader.wasm`).
- License: zxing-wasm's own code is MIT; the ZXing-C++ core it wraps is
  Apache License 2.0.

Both files are fetched from this local path at runtime, not from jsDelivr —
`loadZXing()` in `prototype/template.html` overrides `locateFile` so the
`.wasm` binary is never requested from a CDN. Loaded lazily, only on a device
where native `BarcodeDetector` is absent and the scan sheet is actually
opened — most visitors (Chrome, Android) never download this at all.

# Vendored: tesseract.js (`tess/`)

Powers the "Read a label" sheet's OCR fallback — a photo of the ingredients
text, read on-device, for when a barcode won't scan or the product isn't in
Open Food Facts at all.

- Packages: [tesseract.js](https://github.com/naptha/tesseract.js) 7.0.0
  (Apache-2.0) + `tesseract.js-core` 7.0.0 (Apache-2.0, matched version — the
  worker's core-loader expects the same major/minor as the library) +
  `@tesseract.js-data/eng` 1.0.0 (MIT), the trained data for English.
- Retrieved: 2026-08-27, from jsDelivr.
- Files: `tesseract.min.js` + `worker.min.js` (the library), the bundled
  SIMD+LSTM WASM core (`tesseract-core-simd-lstm.wasm.js` — the fast,
  accurate, broadly-supported variant, WASM inlined as base64 so the worker
  can `importScripts` it directly; the other core variants, including the
  narrower `relaxedsimd` one the worker would otherwise auto-probe for,
  aren't vendored), and `eng.traineddata.gz` (the `4.0.0_best_int` trained
  data, ~3MB compressed — smaller than the default `4.0.0_fast` set).
- License: all three packages are permissive (Apache-2.0 / MIT).

`loadTesseract()` in `prototype/template.html` loads `tesseract.min.js` from
this local path, and `ocrImage()` points `workerPath`/`corePath`/`langPath`
at this same folder so nothing is ever fetched from a CDN — `corePath` is
the exact `.wasm.js` file (a path ending in "js" is used as-is, skipping the
worker's capability probing entirely). Loaded lazily, only if someone
actually taps the photo-OCR button.
