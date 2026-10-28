// 블로그 Durable Object 의 숫자 — 블로그 Worker(jaden-log)의 ViewCounter.report() 를 바인딩으로 부른다
import { env } from 'cloudflare:workers';
import type { Report } from '../../../worker/index';
import { sampleReport } from './sample';

export type { Report };
export type Loaded = { report: Report; sample: boolean } | { error: string };

const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

/** 개발 서버에서는 블로그 Worker 가 안 떠 있거나 ADMIN_SAMPLE=1 이면 표본(sample: true). 배포에서는 표본을 쓰지 않는다 */
export async function loadReport(): Promise<Loaded> {
  if (import.meta.env.DEV && env.ADMIN_SAMPLE === '1') return { report: sampleReport(kstToday()), sample: true };
  try {
    return { report: await env.VIEWS.get(env.VIEWS.idFromName('site')).report(), sample: false };
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn(`[admin] 블로그 Durable Object 에 닿지 못해 표본을 씁니다: ${e instanceof Error ? e.message : e}`);
      return { report: sampleReport(kstToday()), sample: true };
    }
    return { error: e instanceof Error ? e.message : String(e) };
  }
}
