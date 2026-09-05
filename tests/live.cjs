const { queryBangumi } = require("../dist-electron/electron/service.js");
(async () => {
  for (const query of [
    { mode: "search", keyword: "葬送的芙莉莲", offset: 0 },
    { mode: "season", keyword: "", year: 2026, quarter: 3, offset: 0 },
  ]) {
    const page = await queryBangumi(query);
    if (!page.items.length)
      throw new Error("Expected results for " + query.mode);
    console.log(
      JSON.stringify({
        mode: query.mode,
        total: page.total,
        first: page.items[0].name,
        cover: !!page.items[0].cover,
      }),
    );
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
