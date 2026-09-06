import React, { useState, useRef, useEffect } from 'react';
import { NodeProps, NodeResizer, Handle, Position } from '@xyflow/react';
import { useTheme, Box, TextField } from '@mui/material';

export type TextAnnotationNodeData = {
  text: string;
  style?: {
    stroke?: string;
    fontSize?: number;
    opacity?: number;
  };
  drawingAnalysis?: string;
  isEditing?: boolean;
};

export type TextAnnotationNodeType = {
  id: string;
  type: 'textAnnotation';
  position: { x: number; y: number };
  data: TextAnnotationNodeData;
  width?: number;
  height?: number;
};

export function TextAnnotationNode({
  id,
  data,
  width = 150,
  height = 50,
  selected,
  dragging,
}: NodeProps<TextAnnotationNodeType>) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data.text);
  const inputRef = useRef<HTMLInputElement>(null);

  const style = data.style || {};
  const textColor = style.stroke || theme.palette.text.primary;
  const fontSize = style.fontSize || 18;
  const opacity = style.opacity || 1;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    // Only allow editing if node is selected (which means we're in edit mode)
    if (selected) {
      setIsEditing(true);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (text !== data.text) {
      // Trigger node update through ReactFlow
      const event = new CustomEvent('updateTextAnnotation', {
        detail: { nodeId: id, text }
      });
      window.dispatchEvent(event);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setText(data.text);
      setIsEditing(false);
    }
  };


  return (
    <>
      <NodeResizer 
        isVisible={!!selected && !dragging && !isEditing}
        minWidth={50}
        minHeight={30}
      />
      <Box
        sx={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isEditing ? 'text' : 'pointer',
          padding: '8px',
          position: 'relative',
          zIndex: 1, // Above zones (-1) but below security nodes (10)
          backgroundColor: 'transparent',
          // Add subtle background on hover for better visibility
          '&:hover': {
            backgroundColor: selected ? 'transparent' : 'rgba(0, 0, 0, 0.02)',
          }
        }}
        onDoubleClick={handleDoubleClick}
      >
        {isEditing ? (
          <TextField
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyPress}
            variant="standard"
            fullWidth
            InputProps={{
              style: {
                color: textColor,
                fontSize,
                opacity,
                textAlign: 'center',
              },
              disableUnderline: true,
            }}
          />
        ) : (
          <Box
            component="div"
            sx={{
              color: textColor,
              fontSize,
              opacity,
              textAlign: 'center',
              wordBreak: 'break-word',
              whiteSpace: 'pre-wrap',
              userSelect: 'none',
              fontWeight: 500,
              letterSpacing: '0.02em',
              // Add text shadow for better visibility
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {data.text}
          </Box>
        )}
      </Box>
    </>
  );
}