// 방문 수 카운터 — 정적 자산 앞에서 /api/views 만 받는다.
// 다른 요청은 wrangler.jsonc 의 run_worker_first 에 걸리지 않아 이 코드를 거치지 않고 자산이 바로 응답한다.
// 숫자는 Durable Object(SQLite) 하나에 날짜별로 쌓는다 — 방문자 IP 같은 개인 정보는 저장하지 않는다.
import { DurableObject } from 'cloudflare:workers';

interface Env {
  VIEWS: DurableObjectNamespace<ViewCounter>;
  ASSETS: Fetcher;
}

/** 한국 시간 기준 날짜 (offset 일 전) */
const kstDay = (offset = 0) => new Date(Date.now() + 9 * 3600_000 - offset * 86400_000).toISOString().slice(0, 10);

export type Views = { total: number; today: number; yesterday: number };

export class ViewCounter extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS days (day TEXT PRIMARY KEY, n INTEGER NOT NULL)');
  }

  hit(): Views {
    this.ctx.storage.sql.exec('INSERT INTO days (day, n) VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET n = n + 1', kstDay());
    return this.stats();
  }

  stats(): Views {
    const sql = this.ctx.storage.sql;
    const day = (d: string) => Number(sql.exec('SELECT n FROM days WHERE day = ?', d).toArray()[0]?.n ?? 0);
    const total = Number(sql.exec('SELECT COALESCE(SUM(n), 0) AS t FROM days').one().t);
    return { total, today: day(kstDay()), yesterday: day(kstDay(1)) };
  }
}

export default {
  async fetch(req, env) {
    if (new URL(req.url).pathname !== '/api/views') return env.ASSETS.fetch(req);
    const counter = env.VIEWS.get(env.VIEWS.idFromName('site'));
    const headers = { 'cache-control': 'no-store' };
    if (req.method === 'POST') return Response.json(await counter.hit(), { headers });
    if (req.method === 'GET') return Response.json(await counter.stats(), { headers });
    return new Response(null, { status: 405, headers: { allow: 'GET, POST' } });
  },
} satisfies ExportedHandler<Env>;
