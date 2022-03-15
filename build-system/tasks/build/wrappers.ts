import type { BuildOptions, CompileWrapper } from "../types";

export const WRAPPERS: Record<CompileWrapper, string> = Object.freeze({
  bento: '(self.BENTO=self.BENTO||[]).push(function(){<%= contents %>})',
  none: '<%= contents %>',
});

export function getWrapper(options: BuildOptions) {
  const wrapper: string = WRAPPERS[options.wrapper ?? 'none'];
  const sentinel = '<%= contents %>';
  const start = wrapper.indexOf(sentinel);
  return {
    banner: { js: wrapper.slice(0, start) },
    footer: { js: wrapper.slice(start + sentinel.length) },
  };
}
