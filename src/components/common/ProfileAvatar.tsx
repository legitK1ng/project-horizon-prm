import React from 'react';
import { cn } from '@/utils/ui';

interface ProfileAvatarProps {
    url?: string | null;
    name: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

const ProfileAvatar: React.FC<ProfileAvatarProps> = ({ url, name, size = 'md', className }) => {
    const initials = name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    const sizeClasses = {
        sm: 'w-10 h-10 text-xs',
        md: 'w-16 h-16 text-xl',
        lg: 'w-24 h-24 text-3xl',
        xl: 'w-32 h-32 text-4xl',
    };

    const colors = [
        'from-blue-500 to-indigo-600',
        'from-purple-500 to-pink-600',
        'from-emerald-500 to-teal-600',
        'from-amber-500 to-orange-600',
    ];

    const colorIndex = name.length % colors.length;

    return (
        <div className={cn(
            "relative rounded-3xl overflow-hidden shadow-lg border-4 border-white dark:border-slate-800 transition-transform hover:scale-105 duration-300 group",
            sizeClasses[size],
            className
        )}>
            {url ? (
                <img
                    src={url}
                    alt={name}
                    className="w-full h-full object-cover"
                    onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                />
            ) : (
                <div className={cn(
                    "w-full h-full flex items-center justify-center font-black text-white bg-gradient-to-br",
                    colors[colorIndex]
                )}>
                    {initials}
                </div>
            )}

            {/* Glossy Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            <div className="absolute inset-0 border border-white/20 rounded-3xl pointer-events-none" />
        </div>
    );
};

export default ProfileAvatar;
