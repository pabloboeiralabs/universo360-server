import ScrollAnimatedElement from "@/components/ScrollAnimatedElement";
import teamImg from "@/assets/team-new.png";

const Team = () => {
  return (
    <section className="py-20 relative overflow-visible" style={{ zIndex: 10 }}>
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/10 to-transparent" />

      <div className="container mx-auto px-4 relative z-10">
        <ScrollAnimatedElement animation="fade-up" className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">
            Nossa <span className="text-gradient">Equipe</span>
          </h2>
          <p className="text-foreground/90 max-w-xl mx-auto">
            Profissionais apaixonados por levar o universo até você.
          </p>
        </ScrollAnimatedElement>

        <ScrollAnimatedElement animation="scale" className="flex justify-center mb-[-80px] sm:mb-[-100px] md:mb-[-120px] relative z-20">
          <div className="relative max-w-4xl w-full">
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-3xl scale-90" />
            <img
              src={teamImg}
              alt="Nossa equipe do Planetário"
              className="relative w-full rounded-2xl border border-border/30 shadow-lg"
            />
          </div>
        </ScrollAnimatedElement>
      </div>
    </section>
  );
};

export default Team;
