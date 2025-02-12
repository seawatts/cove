'use client'

import { format } from 'date-fns'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'

import { api } from '@acme/api/client'
import { Badge } from '@acme/ui/badge'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@acme/ui/card'
import { Icons } from '@acme/ui/icons'
import { cn } from '@acme/ui/lib/utils'
import { Text } from '@acme/ui/typography'

type Device = {
  id: string
  friendly_name: string
  status: string
  protocol: string
  categories: string[]
  location: { room: string; floor: string; zone: string }
  last_online: string
  metadata: { icon_url: string }
}

// Animation variants for the cards
const cardVariants = {
  exit: {
    opacity: 0,
    scale: 0.8,
    transition: {
      duration: 0,
      ease: 'easeOut',
    },
  },
  hidden: {
    opacity: 0,
    scale: 0.8,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0,
      ease: 'easeOut',
    },
  },
}

export function DevicesTable() {
  const { data: devices } = api.useQuery(['devices'])

  if (devices?.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-8">
        <Icons.GalleryVerticalEnd size="xl" variant="muted" />
        <Text>No devices found</Text>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence mode="popLayout">
        {devices?.map((device) => (
          <motion.div
            key={device.id}
            layout
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            layoutId={device.id}
          >
            <Link href={`/devices/${device.id}`} className="block group">
              <Card
                className={cn(
                  'flex h-full flex-col',
                  'group-hover:border-primary/50 group-hover:shadow-md',
                  'transition-all duration-200',
                )}
              >
                <CardHeader>
                  <div className="flex items-center gap-2">
                    {device.metadata.icon_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={device.metadata.icon_url}
                        alt={device.friendly_name}
                        className="size-5 rounded-sm object-contain"
                      />
                    ) : (
                      <Icons.AlertCircle size="sm" variant="muted" />
                    )}
                    <CardTitle>{device.friendly_name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        device.status === 'Online'
                          ? 'default'
                          : device.status === 'Offline'
                            ? 'destructive'
                            : 'outline'
                      }
                    >
                      {device.status}
                    </Badge>
                    <Badge variant="outline">{device.protocol}</Badge>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {device.categories.map((category) => (
                      <Badge key={category} variant="secondary">
                        {category}
                      </Badge>
                    ))}
                  </div>

                  {device.location.room && (
                    <Text className="text-muted-foreground">
                      {device.location.room}
                      {device.location.floor && ` • ${device.location.floor}`}
                      {device.location.zone && ` • ${device.location.zone}`}
                    </Text>
                  )}
                </CardContent>
                <CardFooter className="flex items-center justify-between">
                  <Text className="text-sm text-muted-foreground">
                    Last online:{' '}
                    {device.last_online
                      ? format(new Date(device.last_online), 'PPp')
                      : 'Never'}
                  </Text>
                  <Icons.ArrowRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </CardFooter>
              </Card>
            </Link>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
