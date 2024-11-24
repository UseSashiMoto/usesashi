'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { CalendarDays, Clock, Hash, Info, Mail, MapPin, Phone, User } from "lucide-react";
import React, { useEffect, useState } from 'react';

type DataEntry = Record<string, string | number | boolean | Date | undefined>

const iconMap: Record<string, React.ElementType> = {
  name: User,
  email: Mail,
  phone: Phone,
  address: MapPin,
  date: CalendarDays,
  number: Hash,
  datetime: Clock,
  default: Info
}



export function DataCardComponent({ data = {
  name: "John Doe",
  email: "john@example.com",
  age: 30,
  isActive: true
} }: { data?: DataEntry }) {

  console.log("dataCard", data)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
    console.log('Component mounted with data:', data)
  }, [data])

  const getIcon = (key: string, value: any) => {
    const lowerKey = key.toLowerCase()
    const IconComponent = 
      Object.entries(iconMap).find(([k, _]) => lowerKey.includes(k))?.[1] || 
      (typeof value === 'number' ? Hash : 
      value instanceof Date ? Clock : 
      Info)
    
    return <IconComponent className="w-4 h-4 mr-2 text-muted-foreground" />
  }

  const formatValue = (value: any, key: string) => {
    if (value === undefined || value === null) return 'N/A'
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (value instanceof Date) return value.toLocaleString()
    if (typeof value === 'number') {
      if (['price', 'amount', 'balance'].some(term => key.toLowerCase().includes(term))) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
      }
      return value.toString()
    }
    return String(value)
  }

  const renderDataItem = ([key, value]: [string, any], index: number) => {
    if (typeof value === 'object' && !(value instanceof Date)) return null
    
    return (
      <motion.div
        key={key}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.1 }}
        className="flex items-center p-2 rounded-md hover:bg-gray-100 transition-colors duration-200"
      >
        {getIcon(key, value)}
        <span className="font-medium mr-2">{key}:</span>
        <span>{formatValue(value, key)}</span>
      </motion.div>
    )
  }

  const getTitle = (data: DataEntry): string => {
    if (!data) return 'Data Entry'
    const titleKeys = ['name', 'title', 'id']
    for (const key of titleKeys) {
      if (data[key] !== undefined) {
        return formatValue(data[key], key)
      }
    }
    return 'Data Entry'
  }

  const title = getTitle(data)

  return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: isVisible ? 1 : 0, scale: isVisible ? 1 : 0.9 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="w-full max-w-md mx-auto overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center">
              <span>{title}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {data && typeof data === 'object' && Object.entries(data)
              .filter(([key, value]) => formatValue(value, key) !== title && key !== undefined)
              .map(renderDataItem)}
          </CardContent>
        </Card>
      </motion.div>
  )
}