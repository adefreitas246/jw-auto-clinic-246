// components/ui/index.ts
// Unified cross-platform UI component library.

// Core design system components
export { Avatar } from './Avatar';
export { Badge } from './Badge';
export { BottomSheet } from './BottomSheet';
export { Button } from './Button';
export { Card } from './Card';
export { EmptyState } from './EmptyState';
export { Input } from './Input';
export { ListItem } from './ListItem';
export { LoadingSpinner } from './LoadingSpinner';
export { ScreenHeader } from './ScreenHeader';
export { SectionHeader } from './SectionHeader';
export { Skeleton, SkeletonCard, SkeletonList } from './Skeleton';
export { StatCard } from './StatCard';
export { ToastProvider, showToast } from './Toast';

// Cross-platform app components (iOS glass / Android M3)
export { AppButton } from './AppButton';
export { AppCard } from './AppCard';
export { AppHeader } from './AppHeader';
export { AppModal } from './AppModal';
export { AppStatusBadge } from './AppStatusBadge';
export { AppTextInput } from './AppTextInput';

// iOS-specific
export { GlassCard } from './ios/GlassCard';
export { GlassHeader } from './ios/GlassHeader';
export { GlassTabBar } from './ios/GlassTabBar';
export { LiquidButton } from './ios/LiquidButton';

// Android-specific
export { M3Button } from './android/M3Button';
export { M3Card } from './android/M3Card';
export { M3Header } from './android/M3Header';
export { M3TabBar } from './android/M3TabBar';
