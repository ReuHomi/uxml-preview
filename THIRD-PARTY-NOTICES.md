# Third-party notices

`uxml-preview` itself is Apache-2.0 (see `LICENSE`). This file covers software
redistributed **inside build output**, which carries its own obligations.

## Where this applies

| Artifact | Bundles third-party code? | Notice required |
|---|---|---|
| npm package (`dist/`) | No — `yoga-layout` is an external dependency the consumer installs | No |
| Playground site (`dist-site/`) | **Yes** — `yoga-layout`, including its WebAssembly binary, is inlined | **Yes** |

The published playground is a single self-contained bundle, so it redistributes
`yoga-layout`. MIT requires the copyright notice and permission notice to travel
with such copies, which is what this file is for; the site build also emits a
banner pointing here.

## yoga-layout

- Version: 3.2.1
- Upstream: https://github.com/facebook/yoga
- Declared license: MIT (`"license": "MIT"` in its `package.json`; every shipped
  source file carries the Meta copyright header below)

> Note: the published npm package does not include a `LICENSE` file. The
> permission notice below is the standard MIT text, matching the license the
> package declares and the header its sources carry.

```
Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Build and test tooling

Vite, Vitest, TypeScript, jsdom, pixelmatch and pngjs are development
dependencies. They are not redistributed in either artifact above, so they carry
no notice obligation here.
