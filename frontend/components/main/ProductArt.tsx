import type { ProductKind } from "../../lib/types";
import { Art } from "../site/ui";
export function ProductArt({ kind }: {
    kind: ProductKind;
}) { return <Art kind={kind}/>; }
