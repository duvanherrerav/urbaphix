import isotipo from '../../assets/brand/isotipo-urbaphix.png';
import logotipo from '../../assets/brand/logotipo-urbaphix.jpg';
import banner from '../../assets/brand/banner-urbaphix.png';

const brandAssets = {
  isotipo,
  imagotipo: logotipo,
  logotipo,
  banner
};

const defaultAlt = {
  isotipo: 'Isotipo Urbaphix',
  imagotipo: 'Logotipo Urbaphix',
  logotipo: 'Logotipo Urbaphix',
  banner: 'Banner Urbaphix'
};

export default function BrandLogo({ variant = 'imagotipo', className = '', alt, decorative = false }) {
  const selectedVariant = brandAssets[variant] ? variant : 'imagotipo';

  return (
    <img
      src={brandAssets[selectedVariant]}
      alt={decorative ? '' : (alt || defaultAlt[selectedVariant])}
      aria-hidden={decorative || undefined}
      className={`block max-w-full object-contain ${className}`.trim()}
      loading="eager"
      decoding="async"
    />
  );
}
