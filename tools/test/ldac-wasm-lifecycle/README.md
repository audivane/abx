# ldac_wasm lifecycle fault-injection harness

Bounded native validation for `tools/ldac_wasm.c` construction and teardown
cleanup. It compiles the real glue against the ABI stand-in headers in this
directory (`ldacBT.h` and `ldacdec.h` mirror the pinned libldac 2.00.02 and
hegdi/libldacdec headers; the real artifact identity stays owned by
`tools/build_codec_wasm.sh`) and links stub codec implementations. Allocation
accounting and fault injection happen through GNU/LLVM linker `--wrap` of
`malloc`/`calloc`/`free`, so the glue is not modified.

All allocation pages come from an anonymous mapping pinned at a low fixed
address (`0x08000000`), emulating the WASM linear-memory constraint that makes
the glue's `int32_t` session handles valid; a native malloc address above 2^31
would otherwise corrupt those handles in any harness. There are no external
dependencies beyond a host C compiler.

Covered: every allocation-failure path of `ldac_wasm_encoder_new` (handle
acquire, init, struct/packet/pending allocations), the success paths
(handle/init counts, one padded stereo block, frame serve/copy, flush,
exact-byte stub frame), and `ldac_wasm_decoder_new`/`decode_block`/free for a
valid frame, corrupt-frame refusals, scratch-allocation failure, init failure
and teardown.

Build and run from the repository root (output stays out of the build tree).
The CI `checks` job runs the same commands.

```sh
mkdir -p /tmp/opencode/ldac-wasm-lifecycle
cc -std=c11 -Wall -Wextra -Wno-unused-parameter -Werror \
    -Itools/test/ldac-wasm-lifecycle \
    tools/test/ldac-wasm-lifecycle/lifecycle_test.c tools/ldac_wasm.c \
    -Wl,--wrap=malloc,--wrap=calloc,--wrap=free \
    -o /tmp/opencode/ldac-wasm-lifecycle/lifecycle_test
/tmp/opencode/ldac-wasm-lifecycle/lifecycle_test
```

Exit 0 with only `ok:` lines means every covered path balances its allocations
in bytes and count. This harness does not replace the pinned-codec WASM build,
byte parity or the TypeScript suites.
