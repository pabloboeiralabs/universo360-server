import { Mail, Phone, MapPin, Instagram } from "lucide-react";
import logo from "@/assets/logo-universo360.png";

const Footer = () => {
  return (
    <footer id="contato" className="pt-16 sm:pt-20 pb-4 bg-background/80 border-t border-white/10 relative" style={{ zIndex: 1 }}>
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-6 mb-4 text-center md:text-left">
          {/* Brand */}
          <div className="space-y-4">
            <a href="#" className="flex items-center justify-center md:justify-start gap-3">
              <img src={logo} alt="Universo 360°" className="h-12 w-auto" />
              <span className="text-xl font-bold">Universo 360º</span>
            </a>
            <p className="text-sm text-foreground/90">
              Levando o universo até sua escola com experiências imersivas e
              educativas em 360°.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold mb-4">Links Rápidos</h4>
            <ul className="space-y-2 text-sm text-foreground/90">
              <li>
                <a href="#inicio" className="hover:text-foreground transition-colors">
                  Início
                </a>
              </li>
              <li>
                <a href="#projeto" className="hover:text-foreground transition-colors">
                  O Projeto
                </a>
              </li>
              <li>
                <a href="#atividades" className="hover:text-foreground transition-colors">
                  Atividades
                </a>
              </li>
              <li>
                <a href="#galeria" className="hover:text-foreground transition-colors">
                  Galeria
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold mb-4">Contato</h4>
            <ul className="space-y-3 text-sm text-foreground/90">
              <li className="flex items-center justify-center md:justify-start gap-2">
                <Mail className="w-4 h-4 text-primary" />
                contato@universo360graus.com.br
              </li>
              <li className="flex items-center justify-center md:justify-start gap-2">
                <Phone className="w-4 h-4 text-primary" />
                (47) 92000-1966
              </li>
              <li className="flex items-center justify-center md:justify-start gap-2">
                <MapPin className="w-4 h-4 text-primary shrink-0" />
                Atendemos SP, PR, SC e RS
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h4 className="font-semibold mb-4">Redes Sociais</h4>
            <div className="flex gap-4 justify-center md:justify-start">
              <a
                href="https://www.instagram.com/universo360graus?igsh=MXJrZzI0ZzBhczZzcQ=="
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="https://wa.me/5547920001966?text=Ol%C3%A1!%20Tenho%20interesse%20nos%20servi%C3%A7os%20do%20Planet%C3%A1rio%20Universo%20360%C2%B0.%20Podem%20me%20passar%20mais%20informa%C3%A7%C3%B5es%3F"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-primary transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-4 border-t border-white/10 text-center text-sm text-foreground/90">
          <p>© 2025 Universo 360°. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
