import React, { useState, useEffect } from 'react';
import { Modal } from 'react-native';

/**
 * LAZY MODAL COMPONENT
 * Loads modal content only when visible to save memory
 * Unloads content after closing to free memory
 */
const LazyModal = ({ 
  visible, 
  children, 
  animationType = 'slide',
  presentationStyle = 'pageSheet',
  ...otherProps 
}) => {
  const [shouldRender, setShouldRender] = useState(false);
  const [delayedVisible, setDelayedVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      // Load content when modal becomes visible
      setShouldRender(true);
      // Small delay to ensure smooth animation
      setTimeout(() => {
        setDelayedVisible(true);
      }, 50);
    } else {
      // Hide immediately
      setDelayedVisible(false);
      // Unload content after animation completes
      setTimeout(() => {
        setShouldRender(false);
      }, 300);
    }
  }, [visible]);

  // Don't render anything if modal is not needed
  if (!shouldRender) {
    return null;
  }

  return (
    <Modal
      visible={delayedVisible}
      animationType={animationType}
      presentationStyle={presentationStyle}
      {...otherProps}
    >
      {children}
    </Modal>
  );
};

export default LazyModal;