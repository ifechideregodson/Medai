"use client";
import { useState } from "react";
export default function InferenceButton({ id, disabled }: { id: string; disabled?: boolean }) {
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
  async function run(){setBusy(true);setMessage("");try{const r=await fetch(`/api/analyses/${id}/infer`,{method:"POST"});const j=await r.json();if(!r.ok) throw new Error(j.error||"Inference failed");setMessage(`Inference completed: ${j.result.model.name} ${j.result.model.version}`);window.location.reload();}catch(e){setMessage(e instanceof Error?e.message:"Inference failed");}finally{setBusy(false);}}
  return <div><button onClick={run} disabled={disabled||busy} className="btn bg-slate-900 text-white disabled:opacity-50">{busy?"Running model…":"Run configured model"}</button>{message&&<p className="mt-2 text-xs text-slate-600">{message}</p>}</div>;
}
