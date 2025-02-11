import { Button } from '@acme/ui/button'
import { Icons } from '@acme/ui/icons'
import { H1 } from '@acme/ui/typography'
import { Suspense } from 'react'
import { DevicesTable } from './_components/devices-table'

export default function DevicesPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <H1>Devices</H1>
          <Button variant="outline" size="icon">
            <Icons.ListFilter className="size-4" />
            <span className="sr-only">Filter devices</span>
          </Button>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon">
            <Icons.SlidersHorizontal className="size-4" />
            <span className="sr-only">Configure devices</span>
          </Button>
          <Button>
            <Icons.Plus className="size-4 mr-2" />
            Add Device
          </Button>
        </div>
      </div>

      <div className="relative">
        <Suspense
          fallback={
            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
              <Icons.Spinner className="size-6 animate-spin text-primary" />
            </div>
          }
        >
          <DevicesTable />
        </Suspense>
      </div>
    </div>
  )
}
