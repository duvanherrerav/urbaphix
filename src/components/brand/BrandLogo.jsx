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
  compact: 'logotipo',
  loading: 'banner'
};

const defaultAlt = {
  isotipo: 'Isotipo Urbaphix',
  imagotipo: 'Urbaphix',
  logotipo: 'Logotipo Urbaphix',
  banner: 'Banner Urbaphix',
  compact: 'Urbaphix',
  header: 'Urbaphix',
  sidebar: 'Urbaphix',
  loading: 'Banner Urbaphix'
};

const brandTextClass = 'font-bold leading-none tracking-tight text-app-text-primary';

function BrandLockup({ variant, className, alt, decorative }) {
  const accessibleName = alt || defaultAlt[variant];
  const showDescriptor = variant === 'sidebar';

  return (
    <div
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : accessibleName}
      className={`flex min-w-0 items-center gap-2 ${className}`.trim()}
      role={decorative ? undefined : 'img'}
    >
      <img
        src={isotipo}
        alt=""
        aria-hidden="true"
        className="h-8 w-8 shrink-0 object-contain"
        loading="eager"
        decoding="async"
      />
      <div className="min-w-0">
        <span className={`block truncate ${brandTextClass} ${showDescriptor ? 'text-lg' : 'text-base'}`}>
          Urbaphix
        </span>
        {showDescriptor && (
          <span className="mt-1 block text-[11px] leading-snug text-app-text-secondary">
            SaaS para propiedad horizontal
          </span>
        )}
      </div>
    </div>
  );
}

export default function BrandLogo({ variant = 'imagotipo', className = '', alt, decorative = false }) {
  if (variant === 'header' || variant === 'sidebar') {
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
