// @ts-check
// 코드 카드 — 스타일 가이드의 헤더바 카드(파일명 헤더 + 출력 카드 분리)를 Expressive Code 프레임으로 옮긴 것
import { defineEcConfig } from 'astro-expressive-code';

export default defineEcConfig({
  themes: ['github-dark-default'],
  useThemedScrollbars: false,
  defaultProps: { wrap: false },
  frames: { showCopyToClipboardButton: true, extractFileNameFromCode: false },
  styleOverrides: {
    borderRadius: '14px',
    borderColor: 'rgba(255,255,255,.10)',
    codeFontFamily: "'JetBrains Mono', 'SF Mono', ui-monospace, Menlo, Consolas, monospace",
    codeFontSize: '13.5px',
    codeLineHeight: '1.7',
    codePaddingInline: '20px',
    codePaddingBlock: '18px',
    codeBackground: '#111114',
    uiFontFamily: "'Pretendard Variable', Pretendard, -apple-system, sans-serif",
    frames: {
      editorTabBarBackground: '#1A1B20',
      editorActiveTabBackground: '#1A1B20',
      editorActiveTabForeground: '#A1A1A6',
      editorActiveTabIndicatorTopColor: 'transparent',
      editorActiveTabIndicatorBottomColor: 'transparent',
      editorTabBarBorderBottomColor: 'rgba(255,255,255,.08)',
      terminalTitlebarBackground: '#1A1B20',
      terminalTitlebarForeground: '#A1A1A6',
      terminalTitlebarBorderBottomColor: 'rgba(255,255,255,.08)',
      terminalBackground: '#0B0B0D',
      frameBoxShadowCssValue: 'none',
      inlineButtonBackground: 'rgba(255,255,255,.10)',
      inlineButtonForeground: '#F5F5F7',
      inlineButtonBorder: 'rgba(255,255,255,.18)',
      tooltipSuccessBackground: '#2997FF',
    },
  },
});
