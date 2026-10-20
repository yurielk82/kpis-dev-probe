// KPIS 개발계 MA111~MA116 동작 확인 2차 (가이드 공개 테스트 계정, aplHbin 1058211787)
// 상품 값은 표준코드 마스터(상한가·포장내총수량)에 맞춘 실제 표준코드를 쓴다
const BASE = "http://devopenapi.kpis.or.kr/v1";
const HBIN = "1058211787";
const RUN = process.env.GITHUB_RUN_NUMBER ?? "0";

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
// 개발 서버는 연결이 자주 끊긴다(2026-10-21 3차: 10초 뒤 fetch failed). 시험이라 끊기면 3초 쉬고 최대 4번 다시 한다
async function post(path, body, token) {
  let r;
  for (let i = 0; i < 4; i++) {
    await pause(1500);
    r = await postOnce(path, body, token);
    if (r.status !== 0) return { ...r, tries: i + 1 };
    await pause(3000);
  }
  return { ...r, tries: 4 };
}
async function postOnce(path, body, token) {
  const headers = { "Content-Type": "application/json", Accept: "*/*" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const t0 = Date.now();
  try {
    const res = await fetch(BASE + path, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
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
const brief = (r) => {
  const j = r.json ?? {};
  return {
    status: r.status,
    tries: r.tries,
    ms: r.ms,
    result: j.result,
    msg: j.resultMessage,
    succCnt: j.succCnt,
    retnCnt: j.retnCnt,
    apiRcvNo: j.apiRcvNo,
    hiraRcvNo: j.hiraRcvNo,
    stat: j.dataPrsStatCd,
    statNm: j.dataPrsStatNm,
    apiTpNm: j.apiTpNm,
    items: (j.items ?? []).slice(0, 12),
    itemsTotal: (j.items ?? []).length,
  };
};

// 일련번호 생략 품목(을지 없음)
const P1 = {
  cd: "8806655079826",
  nm: "진코넥정40밀리그램(은행엽건조엑스)",
  pack: "500",
  price: 64000,
};
const P2 = {
  cd: "8806655084219",
  nm: "유니페니돈정200밀리그램(피르페니돈)",
  pack: "100",
  price: 210000,
};
// 일련번호 부착 품목(을지 필요)
const P3 = {
  cd: "8806655084714",
  nm: "유니베포타서방정(베포타스틴베실산염)",
  pack: "30",
  price: 9780,
};

function row(sno, p, day, over = {}) {
  const qty = over.qty ?? 2;
  const price = over.price ?? p.price;
  return {
    msupMsfrSno: String(sno),
    bsncTpCd: "1",
    msupCtrtMthCd: "1",
    msupSplyFrmCd: "6",
    tkrHbinNm: "심평원",
    tkrHbin: HBIN,
    tkrpYkiho: "",
    msupStdCdNm: p.nm,
    msupStdCd: p.cd,
    msupPackInTotQty: over.pack ?? p.pack,
    msupSplyQty: String(qty),
    splyDd: day,
    msupSplyAmt: String(over.amt ?? qty * price),
    msupSplyUnprc: String(price),
    msupRcvNo: over.rcvNo ?? "",
    msupRetnCmpsCd: "",
    msupMnfNo: "T26A01",
    maxDstbDd: "281231",
    msupSnoTpCd: over.snoTp ?? "0",
    msupRmkTxt: "",
  };
}
const serials = (sno, n, tag) =>
  Array.from({ length: n }, (_, i) => ({
    msupMsfrSno: String(sno),
    msupDtfrSno: `TST${RUN.padStart(4, "0")}${tag}${String(sno).padStart(3, "0")}${i}`,
    msupBno: "",
    msupRfidTagCd: "",
    msupRmkTxt: "",
  }));

let jwt;
async function token() {
  const t = await post("/auth/jwt", {
    client_id: process.env.KPIS_CID,
    client_secret: process.env.KPIS_SEC,
  });
  log("JWT", { status: t.status, ms: t.ms, ok: !!t.json.jwt });
  jwt = t.json.jwt;
}
async function submit(name, splyTpCd, msfr, dtfr = []) {
  const body = {
    aplHbin: HBIN,
    splyTpCd,
    msfr,
    ...(dtfr.length ? { dtfr } : {}),
  };
  const r = await post("/services/stgSplyDescBriefInfo.do", body, jwt);
  const apiRcvNo = r.json.apiRcvNo;
  let res = null;
  // 처리중(2)이면 5초 간격 최대 2분
  for (let i = 0; apiRcvNo && i < 24; i++) {
    res = await post(
      "/services/getSplyDescBriefRstInfo.do",
      { aplHbin: HBIN, apiRcvNo },
      jwt,
    );
    if (res.json.dataPrsStatCd !== "2") break;
    await new Promise((ok) => setTimeout(ok, 5000));
  }
  log(`${name} — MA111`, { status: r.status, ms: r.ms, json: r.json });
  if (res) log(`${name} — MA112`, brief(res));
  return { apiRcvNo, res: res?.json ?? {} };
}

await token();
const D = "20261019";

const E = await submit("E 정상1(생략품목)", "1", [row(1, P1, D)]);
await submit("F 정상1+단가오류1(1원)", "1", [
  row(1, P1, "20261018"),
  row(2, P2, "20261018", { price: 1 }),
]);
await submit("G 정상1+포장수량오류1", "1", [
  row(1, P1, "20261017"),
  row(2, P2, "20261017", { pack: "7" }),
]);
await submit("H E와 같은 내용 재전송(중복)", "1", [row(1, P1, D)]);
await submit(
  "L 일련번호 부착품목, 가짜 일련번호 2개",
  "1",
  [row(1, P3, "20261016", { snoTp: "1" })],
  serials(1, 2, "L"),
);
await submit("L2 일련번호 부착품목인데 을지 없음", "1", [
  row(1, P3, "20261016", { snoTp: "1" }),
]);
await submit("K 반품(2) 정상1", "2", [row(1, P1, "20261015")]);

// 대량: 정상 100줄 / 100줄 중 1줄 단가오류
const many = (day, bad) =>
  Array.from({ length: 100 }, (_, i) =>
    row(i + 1, i % 2 ? P1 : P2, day, bad === i + 1 ? { price: 1 } : {}),
  );
await submit("M 정상 100줄", "1", many("20261014"));
await submit("N 100줄 중 37번 단가오류", "1", many("20261013", 37));

// 접수완료된 E를 대상으로 정정·취소·반송
const hira = E.res.hiraRcvNo;
if (hira) {
  await submit("J 정정(4): E 1번 줄 수량 2→3", "4", [
    row(1, P1, D, { qty: 3, rcvNo: hira }),
  ]);
  await submit("I 취소(5): E 1번 줄", "5", [row(1, P1, D, { rcvNo: hira })]);
  const rb = await post(
    "/services/stgSplyRetnBriefInfo.do",
    {
      aplHbin: HBIN,
      hiraRcvNo: hira,
      hiraRcvDd: hira.slice(0, 8),
      msupMsfrSno: "1",
      retnRsTxt: "단가 및 수량 정정",
    },
    jwt,
  );
  log("O MA113 반송신청 E", rb);
  const rq = await post(
    "/services/getSplyRetnReqRstInfo.do",
    { aplHbin: HBIN, hiraRcvNo: hira, msupMsfrSno: "1", splyDd: D },
    jwt,
  );
  log("O MA114 반송결과 E", rq);
} else {
  log("E 접수번호 없음 — 정정·취소·반송 생략", {});
}

const q = await post(
  "/services/getTimelyBriefRateListQtInfo.do",
  { aplHbin: HBIN, rcvYr: "2026", rcvQt: "", owcpOtcTpCd: "" },
  jwt,
);
log("P MA116 적기보고율", q);
// 토큰 없이 / 잘못된 토큰
log(
  "Q 토큰없이 MA112",
  await post(
    "/services/getSplyDescBriefRstInfo.do",
    { aplHbin: HBIN, apiRcvNo: E.apiRcvNo },
    null,
  ),
);
log(
  "R 다른 사업자번호로 MA112",
  await post(
    "/services/getSplyDescBriefRstInfo.do",
    { aplHbin: "1234567890", apiRcvNo: E.apiRcvNo },
    jwt,
  ),
);
