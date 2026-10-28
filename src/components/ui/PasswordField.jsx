import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import IconButton from './IconButton.jsx'
import TextField from './TextField.jsx'

/** Password input with a show/hide toggle (Eye icon in the trailing slot, as in the Figma auth forms). */
export default function PasswordField(props) {
  const [visible, setVisible] = useState(false)
  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      rightSlot={
        <IconButton
          icon={visible ? EyeOff : Eye}
          label={visible ? 'Hide password' : 'Show password'}
          onClick={() => setVisible((current) => !current)}
        />
      }
    />
  )
}
