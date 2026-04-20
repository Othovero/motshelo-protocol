import { Suspense } from "react"
import MotsheloApp from "@/components/motshelo-app"

export default function Page() {
  return (
    <Suspense>
      <MotsheloApp />
    </Suspense>
  )
}
