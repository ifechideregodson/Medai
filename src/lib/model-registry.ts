import { db } from "@/lib/db";
export async function getActiveModel(modality:string){return db.modelRegistry.findFirst({where:{modality,status:"ACTIVE"},orderBy:{updatedAt:"desc"}})}
export async function registerModel(data:{name:string;version:string;modality:string;intendedUse:string;validationInfo?:string;endpoint?:string}){return db.modelRegistry.create({data:{...data,status:"TESTING"}})}