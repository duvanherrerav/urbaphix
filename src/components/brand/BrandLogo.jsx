import isotipo from '../../assets/brand/isotipo-urbaphix.png';
import logotipo from '../../assets/brand/logotipo-urbaphix.jpg';
import banner from '../../assets/brand/banner-urbaphix.png';

const brandAssets = {
  isotipo,
  imagotipo: logotipo,
  logotipo,
  banner
};

const variantAliases = {
  compact: 'logotipo'
};

const defaultAlt = {
  isotipo: 'Isotipo Urbaphix',
  imagotipo: 'Urbaphix',
  logotipo: 'Logotipo Urbaphix',
  banner: 'Banner Urbaphix',
  compact: 'Urbaphix',
  header: 'Urbaphix',
  sidebar: 'Urbaphix',
  loading: 'Urbaphix'
};

const brandTextClass = 'leading-none tracking-tight text-app-text-primary';

function BrandLockup({ variant, className, alt, decorative }) {
  const accessibleName = alt || defaultAlt[variant];
  const showDescriptor = variant === 'sidebar';
  const showBrandName = variant !== 'loading';

  const variantStyles = {
    header: {
      container: 'gap-1.5 opacity-70',
      icon: 'h-5 w-5',
      text: 'text-sm font-medium tracking-[-0.02em]'
    },
    sidebar: {
      container: 'gap-2 opacity-90',
      icon: 'h-7 w-7',
      text: 'text-base font-semibold tracking-[-0.02em]'
    },
    loading: {
      container: 'flex-col gap-3 text-center',
      icon: 'h-12 w-12',
      text: 'text-base font-semibold tracking-[-0.02em]'
    }
  };

  const styles = variantStyles[variant] || variantStyles.header;

  return (
    <div
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : accessibleName}
      className={`flex min-w-0 items-center ${styles.container} ${className}`.trim()}
      role={decorative ? undefined : 'img'}
    >
      <img
        src={isotipo}
        alt=""
        aria-hidden="true"
        className={`${styles.icon} shrink-0 object-contain`}
        loading="eager"
        decoding="async"
      />
      {showBrandName && (
        <div className="min-w-0">
          <span className={`block truncate ${brandTextClass} ${styles.text}`}>
            Urbaphix
          </span>
          {showDescriptor && (
            <span className="mt-0.5 block text-[10px] leading-snug text-app-text-secondary/80">
              SaaS para propiedad horizontal
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function BrandLogo({ variant = 'imagotipo', className = '', alt, decorative = false }) {
  if (variant === 'header' || variant === 'sidebar' || variant === 'loading') {
    return <BrandLockup variant={variant} className={className} alt={alt} decorative={decorative} />;
  }

  const selectedVariant = brandAssets[variant] ? variant : variantAliases[variant] || 'imagotipo';

  return (
    <img
      src={brandAssets[selectedVariant]}
      alt={decorative ? '' : (alt || defaultAlt[variant] || defaultAlt[selectedVariant])}
      aria-hidden={decorative || undefined}
      className={`block max-w-full object-contain ${className}`.trim()}
      loading="eager"
      decoding="async"
    />
  );
}
