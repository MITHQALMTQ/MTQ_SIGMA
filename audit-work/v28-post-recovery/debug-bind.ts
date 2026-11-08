// debug param binding
import { Database } from "bun:sqlite";
const c = new Database("/home/z/my-project/db/chain.db", { readonly: true });
console.log("literal:", JSON.stringify(c.query("SELECT height FROM blocks WHERE height=1").get()));
console.log("param-list:", JSON.stringify(c.query("SELECT height FROM blocks WHERE height=?", [1]).all()));
console.log("param-direct:", JSON.stringify(c.query("SELECT height FROM blocks WHERE height=?", 1).all()));
console.log("stmt-get:", JSON.stringify(c.query("SELECT height FROM blocks WHERE height=?").get(1)));
console.log("minmax:", JSON.stringify(c.query("SELECT MIN(height) a, MAX(height) b, COUNT(*) n FROM blocks").get()));
const mn = c.query("SELECT MIN(height) h FROM blocks").get() as { h: number };
console.log("mn:", JSON.stringify(mn), "row@mn:", JSON.stringify(c.query("SELECT substr(hash,1,24) h FROM blocks WHERE height=?", [mn.h]).get()));
