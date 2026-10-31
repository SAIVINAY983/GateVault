import React, { useState } from 'react';

const StarRating = ({
    value = 0,
    onChange,
    readOnly = false,
    size = 'md', // 'sm', 'md', 'lg'
    showLabel = false,
    labelClassName = 'text-muted ms-2 small'
}) => {
    const [hoverValue, setHoverValue] = useState(0);

    const sizeClasses = {
        sm: 'fs-6',
        md: 'fs-5',
        lg: 'fs-3'
    };

    const ratingLabels = {
        1: 'Poor',
        2: 'Fair',
        3: 'Good',
        4: 'Very Good',
        5: 'Excellent'
    };

    const displayRating = hoverValue || value || 0;

    return (
        <div className="d-inline-flex align-items-center star-rating-container">
            <div className="d-inline-flex align-items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled = star <= displayRating;
                    return (
                        <i
                            key={star}
                            className={`bi ${isFilled ? 'bi-star-fill text-warning' : 'bi-star text-secondary opacity-50'} ${sizeClasses[size] || sizeClasses.md} ${!readOnly ? 'cursor-pointer' : ''}`}
                            style={{
                                cursor: readOnly ? 'default' : 'pointer',
                                transition: 'transform 0.15s ease, color 0.15s ease',
                                transform: !readOnly && hoverValue === star ? 'scale(1.2)' : 'scale(1)'
                            }}
                            onMouseEnter={() => !readOnly && setHoverValue(star)}
                            onMouseLeave={() => !readOnly && setHoverValue(0)}
                            onClick={() => !readOnly && onChange && onChange(star)}
                            role={readOnly ? 'img' : 'button'}
                            aria-label={`${star} Star${star > 1 ? 's' : ''}`}
                        />
                    );
                })}
            </div>
            {showLabel && (
                <span className={labelClassName}>
                    {displayRating > 0 ? (
                        <>
                            <strong>{displayRating}</strong> / 5{' '}
                            {ratingLabels[displayRating] && (
                                <span className="text-secondary">({ratingLabels[displayRating]})</span>
                            )}
                        </>
                    ) : (
                        'Not rated'
                    )}
                </span>
            )}
        </div>
    );
};

export default StarRating;

