// 관리자 화면용 Google 열쇠(refresh token) 받기 — Search Console·AdSense 를 읽기 전용으로 읽는다
//   node admin/scripts/google-token.mjs <client_secret_….json>
// 데스크톱 앱 OAuth: 이 컴퓨터(127.0.0.1)에 잠깐 수신 주소를 열고, PKCE 로 받은 코드를 열쇠로 바꾼다. Google 외의 곳으로는 아무것도 보내지 않는다.
// 찍힌 열쇠가 대화 기록에 남지 않게 Claude Code 의 ! 가 아닌 따로 연 터미널에서 실행한다
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

const SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly', 'https://www.googleapis.com/auth/adsense.readonly'];

const file = process.argv[2];
if (!file) {
  console.error('사용법: node admin/scripts/google-token.mjs <클라이언트 만들 때 받은 client_secret_….json>');
  process.exit(1);
}
// 데스크톱 앱 클라이언트의 JSON 은 installed 아래에 값이 있다
const { client_id, client_secret } = JSON.parse(readFileSync(file, 'utf8')).installed ?? {};
if (!client_id || !client_secret) {
  console.error('JSON 에 installed.client_id·client_secret 이 없습니다. 클라이언트 유형이 "데스크톱 앱"인지 확인하세요.');
  process.exit(1);
}

const b64url = (buf) => buf.toString('base64url');
const verifier = b64url(randomBytes(32));
const challenge = b64url(createHash('sha256').update(verifier).digest());
const state = b64url(randomBytes(16));

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname !== '/') return res.writeHead(404).end();
  const done = (msg) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(`<p style="font:16px system-ui;margin:40px">${msg}</p>`);
    server.close();
  };
  // Google 이 돌려보낸 요청이 아니면(state 가 다르면) 거절만 하고 계속 기다린다
  if (url.searchParams.get('state') !== state) return res.writeHead(400).end();
  if (url.searchParams.get('error')) {
    console.error(`동의하지 않았거나 실패했습니다: ${url.searchParams.get('error')}`);
    return done('동의가 취소되었습니다. 터미널을 확인하세요.');
  }
  const token = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      code: url.searchParams.get('code'),
      client_id,
      client_secret,
      redirect_uri: redirect,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  }).then((r) => r.json());
  if (!token.refresh_token) {
    console.error('열쇠를 받지 못했습니다:', token.error_description ?? token.error ?? token);
    return done('열쇠를 받지 못했습니다. 터미널을 확인하세요.');
  }
  done('완료했습니다. 터미널로 돌아가세요.');

  // 체크를 하나 빼고 동의하면 그 서비스는 읽을 수 없다
  const granted = (token.scope ?? '').split(' ');
  const missing = SCOPES.filter((s) => !granted.includes(s));
  if (missing.length) console.warn(`\n⚠ 동의하지 않은 권한: ${missing.join(', ')} — 다시 실행해 둘 다 체크하세요.`);

  // 같은 계정인지 확인 — Search Console 속성과 AdSense 계정 목록
  const auth = { headers: { authorization: `Bearer ${token.access_token}` } };
  const sites = await fetch('https://www.googleapis.com/webmasters/v3/sites', auth).then((r) => r.json());
  console.log('\nSearch Console 속성:');
  for (const s of sites.siteEntry ?? []) console.log(`  ${s.siteUrl} (${s.permissionLevel})`);
  if (!sites.siteEntry?.length) console.log('  없음 — 블로그를 등록한 계정으로 다시 실행하세요.');
  const ads = await fetch('https://adsense.googleapis.com/v2/accounts', auth).then((r) => r.json());
  console.log('AdSense 계정:');
  for (const a of ads.accounts ?? []) console.log(`  ${a.displayName} (${a.name})`);
  if (!ads.accounts?.length) console.log(`  없음${ads.error ? ` — ${ads.error.message}` : ''} (승인 전이면 정상)`);

  console.log(`\nrefresh token:\n${token.refresh_token}\n`);
  // --name 을 꼭 붙인다 — 빠지면 wrangler 가 상위 폴더의 블로그 설정(jaden-log)을 찾아 블로그 Worker 에 넣는다
  console.log('관리자 Worker 1단계 배포가 끝난 뒤 아래 셋을 실행하고, 물으면 값을 붙여 넣으세요:');
  console.log('  npx wrangler secret put GOOGLE_CLIENT_ID --name jaden-log-admin       ← JSON 의 client_id');
  console.log('  npx wrangler secret put GOOGLE_CLIENT_SECRET --name jaden-log-admin   ← JSON 의 client_secret');
  console.log('  npx wrangler secret put GOOGLE_REFRESH_TOKEN --name jaden-log-admin   ← 위 refresh token');
});

let redirect;
server.listen(0, '127.0.0.1', () => {
  redirect = `http://127.0.0.1:${server.address().port}`;
  const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  auth.search = new URLSearchParams({
    client_id,
    redirect_uri: redirect,
    response_type: 'code',
    scope: SCOPES.join(' '),
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    access_type: 'offline', // refresh token 을 받으려면
    prompt: 'consent', // 이미 동의한 적이 있어도 refresh token 을 다시 받게
  });
  console.log(`브라우저에서 Google 로그인을 엽니다. 열리지 않으면 이 주소를 직접 여세요:\n${auth}\n`);
  spawn('open', [auth.toString()], { stdio: 'ignore' }).on('error', () => {});
});
// 5분 안에 동의하지 않으면 끝낸다
setTimeout(() => {
  console.error('5분이 지나 끝냅니다. 다시 실행하세요.');
  process.exit(1);
}, 5 * 60_000).unref();
