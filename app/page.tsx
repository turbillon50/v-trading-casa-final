import { AppShell } from '@/components/app-shell'
import { CommandCenter } from '@/components/command-center'

export default function Home() {
  return (
    <AppShell title="Command Center">
      <CommandCenter />
    </AppShell>
  )
}
