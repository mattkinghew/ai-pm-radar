import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const accessId = process.env.CF_ACCESS_CLIENT_ID;
const accessSecret = process.env.CF_ACCESS_CLIENT_SECRET;
const ingestToken = process.env.INGEST_TOKEN;

if (!accessId || !accessSecret || !ingestToken) {
  console.error("Blocked: set CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET, and INGEST_TOKEN in the invoking process; no values were read from files or printed.");
  process.exitCode = 2;
} else {
  try {
    const batchPath = join(homedir(), "radar-x-drop", "batch.json");
    const batch = JSON.parse(await readFile(batchPath, "utf8"));
    if (!batch || !Array.isArray(batch.posts) || batch.posts.length < 1 || batch.posts.length > 200) {
      throw new Error("batch.json must contain a posts array with 1 to 200 entries.");
    }

    const response = await fetch("https://radar-cloud.lamlab.cc/api/ingest/x", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "CF-Access-Client-Id": accessId,
        "CF-Access-Client-Secret": accessSecret,
        authorization: `Bearer ${ingestToken}`,
      },
      body: JSON.stringify(batch),
    });
    console.log(`X batch request completed with HTTP ${response.status}; response body omitted.`);
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    console.error(`X batch ingest failed: ${error.message}`);
    process.exitCode = 1;
  }
}
