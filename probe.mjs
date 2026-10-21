// KPIS 개발계 MA110 공급내역 집계조회 확인 (#96) — 읽기만. 가이드 예시 키·예시 사업자번호와 테스트 사업자번호로
const BASE =
  "http://devopenapi.kpis.or.kr/v1/services/getMsupBriefSummary01Info.do";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function post(body) {
  for (let i = 0; i < 4; i++) {
    await pause(1500);
    const t0 = Date.now();
    try {
      const res = await fetch(BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "*/*" },
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
      return { status: res.status, ms: Date.now() - t0, tries: i + 1, json };
    } catch (e) {
      if (i === 3)
        return {
          status: 0,
          ms: Date.now() - t0,
          tries: 4,
          json: { error: String(e) },
        };
      await pause(3000);
    }
  }
}
const KEY = "3DF64B0C5E064E3DBC54D8B58B33EB87";
const cases = [
  [
    "예시 그대로(가이드 16쪽)",
    {
      apiKey: KEY,
      aplHbin: "1111133321",
      splyHbin: "1111133321",
      splyTpCd: "1",
      splyDd: "20250812",
      tkrHbin: "",
      ykiho: "34804129",
    },
  ],
  [
    "예시 키, 거래처 조건 없음",
    {
      apiKey: KEY,
      aplHbin: "1111133321",
      splyHbin: "1111133321",
      splyTpCd: "1",
      splyDd: "20250812",
      tkrHbin: "",
      ykiho: "",
    },
  ],
  [
    "예시 키, 공급구분 NULL",
    {
      apiKey: KEY,
      aplHbin: "1111133321",
      splyHbin: "1111133321",
      splyTpCd: "",
      splyDd: "20250812",
      tkrHbin: "",
      ykiho: "",
    },
  ],
  [
    "예시 키, 반품",
    {
      apiKey: KEY,
      aplHbin: "1111133321",
      splyHbin: "1111133321",
      splyTpCd: "2",
      splyDd: "20250812",
      tkrHbin: "",
      ykiho: "",
    },
  ],
  [
    "예시 키 + 테스트 사업자번호",
    {
      apiKey: KEY,
      aplHbin: "1058211787",
      splyHbin: "1058211787",
      splyTpCd: "1",
      splyDd: "20261021",
      tkrHbin: "",
      ykiho: "",
    },
  ],
  [
    "틀린 키",
    {
      apiKey: "00000000000000000000000000000000",
      aplHbin: "1111133321",
      splyHbin: "1111133321",
      splyTpCd: "1",
      splyDd: "20250812",
      tkrHbin: "",
      ykiho: "",
    },
  ],
];
for (const [label, body] of cases) {
  const r = await post(body);
  const j = r.json ?? {};
  const list = j.msupBriefSummary01List;
  console.log(
    `\n### ${label}\n` +
      JSON.stringify(
        {
          status: r.status,
          ms: r.ms,
          tries: r.tries,
          result: j.result,
          msg: j.resultMessage,
          total: j.total,
          listLen: Array.isArray(list) ? list.length : list,
          first: Array.isArray(list) ? list.slice(0, 3) : undefined,
          keys: Object.keys(j),
          raw: j.raw,
          error: j.error,
        },
        null,
        2,
      ),
  );
}
