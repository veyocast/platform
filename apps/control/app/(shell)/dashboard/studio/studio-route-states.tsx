import Link from "next/link";
import {Archive,Sparkles} from "lucide-react";
import {Button} from "@veyocast/ui";
import styles from "./studio.module.css";
export function StudioLoadingState(){return <div aria-busy="true" role="status" className={styles.editorLoading}><span/><strong>Studio voorbereiden</strong><p>Canvas, lettertypen en veilige ontwerptools worden geladen.</p></div>;}
export function StudioEmptyState({archived=false,canCreate=false}:{archived?:boolean;canCreate?:boolean}){return <section className={styles.empty} role="status">{archived?<Archive aria-hidden="true"/>:<Sparkles aria-hidden="true"/>}<h2>Geen passende ontwerpen</h2><p>Pas je filters aan of start met een veilig VeyoCast-template.</p>{canCreate&&<Button asChild><Link href="/dashboard/studio/new">Nieuw ontwerp</Link></Button>}</section>;}
