/*
 * ============================================================
 * Footer.jsx - Pie de página con información legal
 * ============================================================
 * 
 * Incluye:
 * - Marca y descripción
 * - Links a cursos
 * - Links de plataforma (registro, catálogo)
 * - Links legales (Términos, Privacidad, Cookies, Contacto)
 * - Datos del proveedor (razón social, CUIT, email)
 * - Copyright
 */


import { Link } from 'react-router-dom';
import LocaleLink from './LocaleLink';
import { useTranslation } from 'react-i18next';

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="bg-dark-900 border-t border-dark-800 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Marca */}
          <div className="col-span-1 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <img
                src="/favicon.png"
                alt="Firmware Academy"
                className="h-7 w-auto"
              />
              <span className="text-lg font-bold text-dark-50">
                Firmware Academy
              </span>
            </div>
            <p className="text-dark-400 text-sm max-w-md">
              {t('footer.description')}
            </p>
          </div>

          {/* Cursos */}
          <div>
            <h4 className="text-dark-200 font-semibold mb-3 text-sm uppercase tracking-wider">
              {t('footer.sections.courses')}
            </h4>
            <ul className="space-y-2">
              {[
                { name: 'Blockchain en C/C++', slug: 'blockchain-cpp' },
                { name: 'TCP/IP en Linux', slug: 'tcp-ip-linux-c' },
                { name: 'Computer Vision', slug: 'computer-vision' },
                { name: 'ESP32 Firmware', slug: 'esp32-firmware' },
              ].map((course) => (
                <li key={course.slug}>
                  <LocaleLink
                    to={`/courses/${course.slug}`}
                    className="text-dark-400 hover:text-primary-400 text-sm transition-colors"
                  >
                    {course.name}
                  </LocaleLink>
                </li>
              ))}
            </ul>
          </div>

          {/* Plataforma */}
          <div>
            <h4 className="text-dark-200 font-semibold mb-3 text-sm uppercase tracking-wider">
              {t('footer.sections.platform')}
            </h4>
            <ul className="space-y-2">
              <li>
                <LocaleLink to="/courses" className="text-dark-400 hover:text-primary-400 text-sm transition-colors">
                  {t('footer.links.allCourses')}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink to="/register" className="text-dark-400 hover:text-primary-400 text-sm transition-colors">
                  {t('footer.links.createAccount')}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink to="/contacto" className="text-dark-400 hover:text-primary-400 text-sm transition-colors">
                  {t('footer.links.contact')}
                </LocaleLink>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-dark-200 font-semibold mb-3 text-sm uppercase tracking-wider">
              {t('footer.sections.legal')}
            </h4>
            <ul className="space-y-2">
              <li>
                <LocaleLink to="/terminos" className="text-dark-400 hover:text-primary-400 text-sm transition-colors">
                  {t('footer.links.terms')}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink to="/privacidad" className="text-dark-400 hover:text-primary-400 text-sm transition-colors">
                  {t('footer.links.privacy')}
                </LocaleLink>
              </li>
              <li>
                <LocaleLink to="/cookies" className="text-dark-400 hover:text-primary-400 text-sm transition-colors">
                  {t('footer.links.cookies')}
                </LocaleLink>
              </li>
            </ul>
          </div>
        </div>

        {/* Datos del proveedor + Copyright */}
        <div className="border-t border-dark-800 mt-8 pt-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div>
              <p className="text-dark-500 text-sm">
                {t('footer.copyright', { year: new Date().getFullYear() })}
              </p>
              <p className="text-dark-600 text-xs mt-1">
                {t('footer.legalInfo')}
              </p>
            </div>
            <div className="text-dark-600 text-xs">
              <a
                href="mailto:soporte@firmwareacademy.com"
                className="hover:text-dark-400 transition-colors"
              >
                soporte@firmwareacademy.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
