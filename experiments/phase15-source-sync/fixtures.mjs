/**
 * Invented fictional records for the Phase1.5B cross-device pilot.
 * No original Owner/employee/customer/Phase1.3 article content used.
 */
import {normaliseSourceInput} from "../../lib/source-inbox.ts";
import {validateSourceRecord} from "../../lib/source-inbox.ts";
export const STABLE_FIXTURES=[
 {
  id:"src_f1500000000000000000000000000001",
  title:"SYNTHETIC 紙鶴圖書館實驗",
  url:"https://library-one.example.invalid/synthetic",
  raw:"虛構測試資料：紙鶴圖書館每日下午三時開門。館內有十二隻紙鶴機械人。每隻機械人只整理虛構書籍。",
  evidence:"館內有十二隻紙鶴機械人。",
  summaries:[
   "測試版一：虛構圖書館有十二隻紙鶴機械人。",
   "測試版二：機械紙鶴只處理不存在的書籍。",
  ],
 },
 {
  id:"src_f1500000000000000000000000000002",
  title:"SYNTHETIC 雲朵盆栽教室",
  url:"https://garden-two.example.invalid/synthetic",
  raw:"虛構測試資料：雲朵盆栽教室位於不存在的小鎮。課室種植九盆藍色薄荷。每週只有虛構角色參加。",
  evidence:"課室種植九盆藍色薄荷。",
  summaries:[
   "測試版一：雲朵盆栽教室種植九盆藍色薄荷。",
   "測試版二：不存在的小鎮開設雲朵盆栽課。",
  ],
 },
 {
  id:"src_f1500000000000000000000000000003",
  title:"SYNTHETIC 星空便利屋",
  url:"https://stars-three.example.invalid/synthetic",
  raw:"虛構測試資料：星空便利屋沒有真實交易。店內有七盞星形燈。測試人物只借閱虛構的月球地圖。",
  evidence:"店內有七盞星形燈。",
  summaries:[
   "測試版一：星空便利屋陳列七盞星形燈。",
   "測試版二：虛構店員提供不存在的月球地圖。",
  ],
 },
 {
  id:"src_f1500000000000000000000000000004",
  title:"SYNTHETIC 透明風箏練習場",
  url:"https://kite-four.example.invalid/synthetic",
  raw:"虛構測試資料：透明風箏練習場每天展示四個彩色風箏。參與者全是故事中的紙人。練習場從未真實營運。",
  evidence:"每天展示四個彩色風箏。",
  summaries:["測試版一：虛構風箏場每天展示四個風箏。","測試版二：彩色風箏只屬於故事裡的紙人。"],
 },
 {
  id:"src_f1500000000000000000000000000005",
  title:"SYNTHETIC 泡泡天文站",
  url:"https://bubble-five.example.invalid/synthetic",
  raw:"虛構測試資料：泡泡天文站有五台紙製望遠鏡。研究員沒有真實身份。所有天體名稱都由虛構角色創造。",
  evidence:"有五台紙製望遠鏡。",
  summaries:["測試版一：虛構天文站配置五台紙製望遠鏡。","測試版二：泡泡天文站只觀察不存在的星球。"],
 },
 {
  id:"src_f1500000000000000000000000000006",
  title:"SYNTHETIC 橙色拼圖車站",
  url:"https://puzzle-six.example.invalid/synthetic",
  raw:"虛構測試資料：橙色拼圖車站設有六張棋盤桌。車站沒有乘客或票價。每局都以虛構拼圖結束。",
  evidence:"設有六張棋盤桌。",
  summaries:["測試版一：不存在的車站有六張棋盤桌。","測試版二：虛構拼圖車站沒有任何真實交易。"],
 },
];
export function syntheticRecord(item,index=0){
 if(!item||!Number.isSafeInteger(index)||index<0||index>=item.summaries.length)return null;
 const {record}=normaliseSourceInput({
  kind:"paste_text",sourceUrl:item.url,title:item.title,
  value:item.raw,creator:"Phase 1.5B Synthetic QA",
 },{now:"2026-10-15T00:00:00.000Z"});
 const citation={source:item.url,timestamp:null,text_reference:item.evidence};
 const prepared={
  ...record,id:item.id,source_url:item.url,
  source_url_original:item.url,source_url_final:item.url,
  title:item.title,creator:"Phase 1.5B Synthetic QA",
  description:"純屬虛構的跨裝置 SourceRecord 測試文章",
  summary:item.summaries[index],
  key_points:[item.evidence],
  key_claims:[{claim:item.evidence,evidence:[citation]}],
  evidence:[citation],
  rights_note:"SYNTHETIC-only fixture; invented content, no personal or employer data; QA reuse only.",
  material_status:"captured",
  review_status:"needs_review",approval_status:"not_approved",
 };
 const canonical=JSON.parse(JSON.stringify(prepared));
 if(validateSourceRecord(canonical).length)throw Error("Synthetic fixture invalid schema");
 return canonical;
}
export const FIXTURE_RECORDS=STABLE_FIXTURES.map(item=>syntheticRecord(item,0));
export const FIXTURE_ALTERNATE_RECORDS=STABLE_FIXTURES.map(item=>syntheticRecord(item,1));
export function fixedSyntheticRecordAllowed(candidate){
 if(!candidate||typeof candidate!=="object")return false;
 const index=STABLE_FIXTURES.findIndex(item=>item.id===candidate.id);
 if(index<0)return false;
 const sanitised={...candidate,review_status:"needs_review",approval_status:"not_approved"};
 return [FIXTURE_RECORDS[index],FIXTURE_ALTERNATE_RECORDS[index]]
  .some(allowed=>JSON.stringify(sanitised)===JSON.stringify(allowed));
}
