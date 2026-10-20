// KPIS 개발계 MA111/MA112 동작 확인 (가이드 공개 테스트 계정, aplHbin 1058211787)
const BASE = "http://devopenapi.kpis.or.kr/v1";
const HBIN = "1058211787";
const RUN = process.env.GITHUB_RUN_NUMBER ?? "0";

async function post(path, body, token) {
  const headers = { "Content-Type": "application/json", Accept: "*/*" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const t0 = Date.now();
  try {
    const res = await fetch(BASE + path, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 500) };
    }
    return { status: res.status, ms: Date.now() - t0, json };
  } catch (e) {
    return { status: 0, ms: Date.now() - t0, json: { error: String(e) } };
  }
}

const log = (label, v) =>
  console.log(`\n### ${label}\n${JSON.stringify(v, null, 2)}`);

// 가이드 MA111 예시 행을 기본으로, 케이스마다 공급일자·일련번호를 바꿔 중복 판정을 피한다
function msfr(sno, day, over = {}) {
  return {
    msupMsfrSno: String(sno),
    bsncTpCd: "4",
    msupCtrtMthCd: "2",
    msupSplyFrmCd: "6",
    tkrHbinNm: "심평원",
    tkrHbin: HBIN,
    tkrpYkiho: "",
    msupStdCdNm: "루마겔(케토프로펜)(수출명:RemasonRicfen)",
    msupStdCd: "8806435006110",
    msupPackInTotQty: "298",
    msupSplyQty: "2",
    splyDd: day,
    msupSplyAmt: "47524",
    msupSplyUnprc: "23762",
    msupRcvNo: "",
    msupRetnCmpsCd: "",
    msupMnfNo: "AQ05AC",
    maxDstbDd: "270628",
    msupSnoTpCd: "1",
    msupRmkTxt: "",
    ...over,
  };
}
function dtfr(sno, tag) {
  return [1, 2].map((i) => ({
    msupMsfrSno: String(sno),
    msupDtfrSno: `T0110622381L${RUN.padStart(3, "0")}${tag}${sno}${i}`,
    msupBno: "(00)7880657220015A8829ET03",
    msupRfidTagCd: "",
    msupRmkTxt: "",
  }));
}

const CASES = [
  {
    name: "A 정상2+오류1(표준코드)",
    day: "20261013",
    rows: [[1], [2], [3, { msupStdCd: "880643500611" }]],
  },
  { name: "B 정상2", day: "20261014", rows: [[1], [2]] },
  {
    name: "C 오류행이 둘(2번 표준코드, 3번 금액0)",
    day: "20261015",
    rows: [[1], [2, { msupStdCd: "880643500611" }], [3, { msupSplyAmt: "0" }]],
  },
  { name: "D 정상1", day: "20261016", rows: [[1]] },
];

const tok = await post("/auth/jwt", {
  client_id: process.env.KPIS_CID,
  client_secret: process.env.KPIS_SEC,
});
log("JWT 발급", {
  status: tok.status,
  ms: tok.ms,
  ok: !!tok.json.jwt,
  msg: tok.json.msg,
  statusField: tok.json.status,
});
const jwt = tok.json.jwt;
if (!jwt) process.exit(1);

const submitted = [];
for (const c of CASES) {
  const tag = c.name[0];
  const body = {
    aplHbin: HBIN,
    splyTpCd: "1",
    msfr: c.rows.map(([sno, over]) => msfr(sno, c.day, over)),
    dtfr: c.rows.flatMap(([sno]) => dtfr(sno, tag)),
  };
  const r = await post("/services/stgSplyDescBriefInfo.do", body, jwt);
  log(`MA111 ${c.name}`, r);
  submitted.push({ name: c.name, apiRcvNo: r.json.apiRcvNo });
}

// MA112: 처리중(2)이 끝날 때까지 10초 간격, 최대 6분
const pending = new Map(
  submitted.filter((s) => s.apiRcvNo).map((s) => [s.apiRcvNo, s.name]),
);
const seen = new Map();
for (let i = 0; i < 36 && pending.size > 0; i++) {
  for (const [no, name] of [...pending]) {
    const r = await post(
      "/services/getSplyDescBriefRstInfo.do",
      { aplHbin: HBIN, apiRcvNo: no },
      jwt,
    );
    const st = r.json.dataPrsStatCd;
    if (seen.get(no) !== st) {
      log(`MA112 ${name} (${i * 10}s)`, r);
      seen.set(no, st);
    }
    if (st === "3" || st === "4" || r.json.result === "fail")
      pending.delete(no);
  }
  if (pending.size > 0) await new Promise((res) => setTimeout(res, 10000));
}
if (pending.size > 0) log("미완료", [...pending.values()]);
