import "server-only";
import {NextResponse} from "next/server";
export function mobileV2Data<T>(data:T,requestId:string,status=200){return NextResponse.json({data,meta:{requestId,version:"2"}},{status,headers:{"Cache-Control":"private, no-store, max-age=0",Vary:"Authorization, X-VeyoCast-Tenant-Id"}});}
