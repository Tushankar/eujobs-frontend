import { useSharedLocalStorage } from '@/hooks/useSharedLocalStorage.js'
import { INITIAL_COURSES } from '../data/courses.js'

/** All admin-managed courses (both audiences), persisted on this device as `lwm.admin.courses`. */
export function useCourses() {
  const [courses, setCourses] = useSharedLocalStorage('lwm.admin.courses', INITIAL_COURSES)

  function saveCourse(values, existingId) {
    const updatedAt = new Date().toISOString()
    if (existingId) {
      setCourses((current) => current.map((item) => (item.id === existingId ? { ...item, ...values, updatedAt } : item)))
      return existingId
    }
    const slug = values.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const id = `${slug}-${Date.now().toString(36)}`
    setCourses((current) => [{ id, enrolled: 0, purchased: 0, ...values, updatedAt }, ...current])
    return id
  }

  function setStatus(id, status) {
    setCourses((current) => current.map((item) => (item.id === id ? { ...item, status, updatedAt: new Date().toISOString() } : item)))
  }

  return { courses, saveCourse, setStatus }
}
