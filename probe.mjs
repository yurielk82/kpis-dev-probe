// KPIS 개발계 MA113~116·118·119 응답 모양 확인 (#97·#98) — 가이드 공개 테스트 계정, 개발 서버만
import { gunzipSync } from "node:zlib";
const BASE = "http://devopenapi.kpis.or.kr/v1";
const HBIN = "1058211787";
const MA118_KEY = "149592239B63D0E3A6D37A9C7562348D";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(path, body, token, binary = false) {
  const headers = { "Content-Type": "application/json", Accept: "*/*" };
  if (token) headers.Authorization = `Bearer ${token}`;
  for (let i = 0; i < 3; i++) {
    await pause(1000);
    const t0 = Date.now();
    try {
      const res = await fetch(BASE + path, {
        method: "POST", headers, body: JSON.stringify(body),
        signal: AbortSignal.timeout(90000),
      });
      const buf = Buffer.from(await res.arrayBuffer());
      const info = { status: res.status, ms: Date.now() - t0, type: res.headers.get("content-type"), enc: res.headers.get("content-encoding"), bytes: buf.length };
      let text = buf.toString("utf8");
      if (binary && buf[0] === 0x1f && buf[1] === 0x8b) { text = gunzipSync(buf).toString("utf8"); info.gzip = true; }
      try { return { ...info, json: JSON.parse(text) }; } catch { return { ...info, raw: text.slice(0, 400) }; }
    } catch (e) {
      if (i === 2) return { status: 0, error: String(e) };
    }
  }
}

const shape = (v) => Array.isArray(v) ? { listLen: v.length, first: v.slice(0, 2) } : v;
function show(label, r) {
  const j = r.json ?? {};
  const lists = Object.fromEntries(Object.entries(j).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, shape(v)]));
  const scalars = Object.fromEntries(Object.entries(j).filter(([, v]) => !Array.isArray(v)));
  console.log(`\n### ${label}\n${JSON.stringify({ status: r.status, ms: r.ms, type: r.type, enc: r.enc, bytes: r.bytes, gzip: r.gzip, scalars, lists, raw: r.raw, error: r.error, topArray: Array.isArray(r.json) ? shape(r.json) : undefined }, null, 2)}`);
}

const tok = await post("/auth/jwt", { client_id: process.env.KPIS_CID, client_secret: process.env.KPIS_SEC });
console.log(`JWT ${tok.status} ok=${!!tok.json?.jwt} ${tok.json?.msg ?? ""}`);
const jwt = tok.json?.jwt;

// MA116 적기보고율 — 이번·지난 분기, 자사/타사
for (const [yr, qt] of [["2026", "4"], ["2026", "3"], ["2025", "4"]])
  show(`MA116 ${yr}Q${qt}`, await post("/services/getTimelyBriefRateListQtInfo.do", { aplHbin: HBIN, rcvYr: yr, rcvQt: qt, owcpOtcTpCd: "" }, jwt));

// MA115 입고내역 — 최근 기간
const ma115 = await post("/services/getWrhngInfo.do", { aplHbin: HBIN, splyDdSta: "20261001", splyDdEnd: "20261021", exceptYn: "", esbYn: "", msupStdCd: "" }, jwt);
show("MA115 2026-10-01~21", ma115);
show("MA115 2026-09", await post("/services/getWrhngInfo.do", { aplHbin: HBIN, splyDdSta: "20260901", splyDdEnd: "20260930" }, jwt));

// MA119 입고 일련번호 — MA115 첫 줄이 있으면 그 접수번호로
const w = ma115.json?.wrhngInfoList?.[0];
show("MA119 " + (w ? "MA115 첫 줄" : "가짜 접수번호"), await post("/services/getWrhngDtfrInfo.do", { aplHbin: HBIN, hiraRcvNo: w?.msupRcvNo ?? "20261013000000000001", msupMsfrSno: w?.msupMsfrSno ?? "1", startPageIdx: "0", pageRecodeCnt: "1000" }, jwt));

// MA114 반송신청 결과 — 공급일자만, 가짜 접수번호
show("MA114 공급일자 20261013", await post("/services/getSplyRetnReqRstInfo.do", { aplHbin: HBIN, splyDd: "20261013", hiraRcvNo: "", msupMsfrSno: "" }, jwt));
show("MA114 가짜 접수번호", await post("/services/getSplyRetnReqRstInfo.do", { aplHbin: HBIN, splyDd: "20261013", hiraRcvNo: "20261013000000000001", msupMsfrSno: "1" }, jwt));

// MA113 반송신청 — 개발 서버, 없는 접수번호(오류 응답 모양만)
show("MA113 없는 접수번호", await post("/services/stgSplyRetnBriefInfo.do", { aplHbin: HBIN, hiraRcvDd: "20261013", hiraRcvNo: "20261013000000000001", msupMsfrSno: "1", retnRsTxt: "개발 서버 응답 모양 확인" }, jwt));

// MA118 표준코드 전체 (API KEY)
show("MA118 테스트 키", await post("/services/getDownloadMsupStdCdInfoStreamJson.do", { aplHbin: HBIN, apiKey: MA118_KEY }, null, true));
show("MA118 틀린 키", await post("/services/getDownloadMsupStdCdInfoStreamJson.do", { aplHbin: HBIN, apiKey: "00000000000000000000000000000000" }, null, true));
