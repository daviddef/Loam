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
