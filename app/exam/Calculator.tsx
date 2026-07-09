'use client';

import { useState } from 'react';
import styles from './calculator.module.css';

export default function Calculator({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [isNewNumber, setIsNewNumber] = useState(true);

  const handleNum = (num: string) => {
    if (isNewNumber) {
      setDisplay(num);
      setIsNewNumber(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const handleOp = (op: string) => {
    setEquation(display + ' ' + op + ' ');
    setIsNewNumber(true);
  };

  const calculate = () => {
    try {
      if (!equation) return;
      const fullEq = equation + display;
      // using eval safely here as we only allow digits and basic operators
      const sanitizedEq = fullEq.replace(/[^-()\d/*+.]/g, '');
      const result = eval(sanitizedEq);
      setDisplay(String(result));
      setEquation('');
      setIsNewNumber(true);
    } catch (e) {
      setDisplay('Error');
    }
  };

  const clear = () => {
    setDisplay('0');
    setEquation('');
    setIsNewNumber(true);
  };

  return (
    <div className={styles.calcWrapper}>
      <div className={styles.calcHeader}>
        <div className={styles.calcTitle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
            <line x1="8" y1="6" x2="16" y2="6"></line>
            <line x1="16" y1="14" x2="16" y2="14.01"></line>
            <line x1="16" y1="10" x2="16" y2="10.01"></line>
            <line x1="16" y1="18" x2="16" y2="18.01"></line>
            <line x1="12" y1="14" x2="12" y2="14.01"></line>
            <line x1="12" y1="10" x2="12" y2="10.01"></line>
            <line x1="12" y1="18" x2="12" y2="18.01"></line>
            <line x1="8" y1="14" x2="8" y2="14.01"></line>
            <line x1="8" y1="10" x2="8" y2="10.01"></line>
            <line x1="8" y1="18" x2="8" y2="18.01"></line>
          </svg>
          Kalkulator
        </div>
        <button className={styles.closeBtn} onClick={onClose}>×</button>
      </div>
      <div className={styles.calcScreen}>
        <div className={styles.calcEq}>{equation}</div>
        <div className={styles.calcDisplay}>{display}</div>
      </div>
      <div className={styles.calcGrid}>
        <button className={styles.btnAction} onClick={clear}>C</button>
        <button className={styles.btnAction} onClick={() => handleOp('/')}>÷</button>
        <button className={styles.btnAction} onClick={() => handleOp('*')}>×</button>
        <button className={styles.btnAction} onClick={() => {
          if (display.length > 1) setDisplay(display.slice(0, -1));
          else setDisplay('0');
        }}>⌫</button>
        
        <button className={styles.btnNum} onClick={() => handleNum('7')}>7</button>
        <button className={styles.btnNum} onClick={() => handleNum('8')}>8</button>
        <button className={styles.btnNum} onClick={() => handleNum('9')}>9</button>
        <button className={styles.btnAction} onClick={() => handleOp('-')}>-</button>
        
        <button className={styles.btnNum} onClick={() => handleNum('4')}>4</button>
        <button className={styles.btnNum} onClick={() => handleNum('5')}>5</button>
        <button className={styles.btnNum} onClick={() => handleNum('6')}>6</button>
        <button className={styles.btnAction} onClick={() => handleOp('+')}>+</button>
        
        <button className={styles.btnNum} onClick={() => handleNum('1')}>1</button>
        <button className={styles.btnNum} onClick={() => handleNum('2')}>2</button>
        <button className={styles.btnNum} onClick={() => handleNum('3')}>3</button>
        <button className={styles.btnEqual} onClick={calculate} style={{ gridRow: 'span 2' }}>=</button>
        
        <button className={styles.btnNum} onClick={() => handleNum('0')} style={{ gridColumn: 'span 2' }}>0</button>
        <button className={styles.btnNum} onClick={() => handleNum('.')}>.</button>
      </div>
    </div>
  );
}
