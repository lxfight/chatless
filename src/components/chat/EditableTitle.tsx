"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface EditableTitleProps {
  initialTitle: string;
  onTitleChange: (newTitle: string) => void;
  className?: string;
  inputClassName?: string;
  buttonSize?: "sm" | "icon" | "default" | "lg" | null;
}

export function EditableTitle({
  initialTitle,
  onTitleChange,
  className,
  inputClassName,
  buttonSize = "sm",
}: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEditing = () => {
    setIsEditing(true);
  };

  const handleConfirm = () => {
    if (title.trim() !== '') {
      onTitleChange(title.trim());
      setIsEditing(false);
    } else {
      // Revert to original if input is empty
      setTitle(initialTitle);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setTitle(initialTitle);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleConfirm}
          className={inputClassName || "h-8"}
        />
        <Button onClick={handleConfirm} size={buttonSize} variant="ghost" className="text-green-600 hover:text-green-700 cursor-pointer">
          <Check className="h-4 w-4" />
        </Button>
        <Button onClick={handleCancel} size={buttonSize} variant="ghost" className="text-red-600 hover:text-red-700 cursor-pointer">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <span
      className={className || "cursor-pointer hover:text-primary transition-colors"}
      onClick={handleStartEditing}
      onDoubleClick={handleStartEditing}
      title="点击或双击编辑"
    >
      {initialTitle}
    </span>
  );
} 