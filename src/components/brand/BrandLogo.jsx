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
  header: 'logotipo',
  sidebar: 'logotipo',
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

export default function BrandLogo({ variant = 'imagotipo', className = '', alt, decorative = false }) {
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
