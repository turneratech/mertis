import React, { useState, useRef, useEffect } from 'react';

function MultiSelect({ 
  options, 
  selected, 
  onChange, 
  placeholder = "Search...",
  labelKey = null,
  valueKey = null
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const getLabel = (item) => {
    if (labelKey && typeof item === 'object') return item[labelKey];
    return item;
  };

  const getValue = (item) => {
    if (valueKey && typeof item === 'object') return item[valueKey];
    return item;
  };

  const isSelected = (option) => {
    const val = getValue(option);
    return selected.some(s => (typeof s === 'object' ? getValue(s) : s) === val);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(option => {
    const label = getLabel(option).toLowerCase();
    const matchesSearch = label.includes(searchTerm.toLowerCase());
    const notSelected = !isSelected(option);
    return matchesSearch && notSelected;
  });

  const handleSelect = (option) => {
    const valueToAdd = valueKey ? getValue(option) : option;
    onChange([...selected, valueToAdd]);
    setSearchTerm('');
    inputRef.current?.focus();
  };

  const handleRemove = (item) => {
    const val = typeof item === 'object' ? getValue(item) : item;
    onChange(selected.filter(s => {
      const sVal = typeof s === 'object' ? getValue(s) : s;
      return sVal !== val;
    }));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Backspace' && searchTerm === '' && selected.length > 0) {
      handleRemove(selected[selected.length - 1]);
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
    if (e.key === 'Enter' && filteredOptions.length > 0) {
      e.preventDefault();
      handleSelect(filteredOptions[0]);
    }
  };

  const getSelectedLabel = (selectedItem) => {
    if (valueKey) {
      const option = options.find(o => getValue(o) === selectedItem);
      return option ? getLabel(option) : selectedItem;
    }
    if (typeof selectedItem === 'object') {
      return getLabel(selectedItem);
    }
    return selectedItem;
  };

  return (
    <div className="multi-select-container" ref={containerRef}>
      <div 
        className={`multi-select-input-wrapper ${isOpen ? 'focused' : ''}`}
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
      >
        <div className="multi-select-tags">
          {selected.map((item, idx) => (
            <span key={idx} className="multi-select-tag">
              {getSelectedLabel(item)}
              <button
                type="button"
                className="multi-select-tag-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(item);
                }}
              >
                ×
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            className="multi-select-search"
            placeholder={selected.length === 0 ? placeholder : ''}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
          />
        </div>
        {selected.length > 0 && (
          <button
            type="button"
            className="multi-select-clear"
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
          >
            ×
          </button>
        )}
        <span className="multi-select-arrow">▼</span>
      </div>

      {isOpen && (
        <div className="multi-select-dropdown">
          {filteredOptions.length === 0 ? (
            <div className="multi-select-no-options">
              {searchTerm ? 'No matches found' : 'All options selected'}
            </div>
          ) : (
            filteredOptions.map((option, idx) => (
              <div
                key={idx}
                className="multi-select-option"
                onClick={() => handleSelect(option)}
              >
                {getLabel(option)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default MultiSelect;
