import { useMemo, useState } from 'react';
import { MapPin, Phone, Video, Clock, Languages, Stethoscope } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import { parkinsonSpecialists } from '../data/parkinsonSpecialists';

const Consult = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('All');
  const navigate = useNavigate();

  const availableRegions = useMemo(() => ['All', ...new Set(parkinsonSpecialists.map(doc => `${doc.location}, ${doc.state}`))], []);

  const filteredDoctors = useMemo(() => {
    const normalisedSearch = searchTerm.trim().toLowerCase();

    return parkinsonSpecialists.filter((doctor) => {
      const regionMatches = selectedRegion === 'All' || `${doctor.location}, ${doctor.state}` === selectedRegion;
      const searchMatches = !normalisedSearch || [
        doctor.name,
        doctor.title,
        doctor.hospital,
        doctor.location,
        doctor.state,
        doctor.specialties.join(' '),
        doctor.tags.join(' '),
      ].some((value) => value.toLowerCase().includes(normalisedSearch));

      return regionMatches && searchMatches;
    });
  }, [searchTerm, selectedRegion]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 rounded-[2rem]">
              <Stethoscope className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-4xl font-serif font-bold text-foreground">Consult a Specialist</h2>
          </div>
          <p className="text-muted-foreground text-lg leading-relaxed">
            Browse trusted neurologists across India who focus on Parkinson’s and related movement disorders. Choose a region or search for particular expertise, then call or request a virtual consultation slot.
          </p>
        </div>
        <div className="flex gap-3 flex-col sm:flex-row">
          <select
            value={selectedRegion}
            onChange={(event) => setSelectedRegion(event.target.value)}
            className="rounded-full border border-border/60 bg-white/60 backdrop-blur-sm px-5 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-sm hover:border-primary/50 transition-colors"
          >
            {availableRegions.map((region) => (
              <option key={region} value={region}>{region}</option>
            ))}
          </select>
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search name, hospital..."
            className="rounded-full border border-border/60 bg-white/60 backdrop-blur-sm px-5 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary shadow-sm hover:border-primary/50 transition-colors"
          />
        </div>
      </div>

      <Card className="bg-primary/5 border border-primary/10 rounded-organic-2 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white/60 rounded-2xl flex-shrink-0">
              <Stethoscope className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-foreground text-lg">How we curate this list</h3>
              <p className="text-sm font-medium text-muted-foreground mt-1 leading-relaxed">
                Doctors listed here have neurology specialisations with a track record in Parkinson’s care. Contact details are provided for convenience; availability can change, so please confirm directly with the hospital or clinic.
              </p>
            </div>
          </div>
          <p className="text-xs font-bold text-secondary max-w-xs lg:text-right bg-secondary/10 px-4 py-3 rounded-[1.5rem]">
            Emergency symptoms such as sudden weakness, chest pain, or confusion require immediate local medical attention—call your nearest hospital or emergency helpline.
          </p>
        </div>
      </Card>

      {filteredDoctors.length === 0 ? (
        <Card className="rounded-organic-3 bg-white/60 border-dashed border-2">
          <div className="text-center py-16">
            <div className="bg-secondary/10 w-20 h-20 mx-auto rounded-[2rem] flex items-center justify-center mb-4">
              <span className="text-secondary font-serif text-2xl font-bold">?</span>
            </div>
            <h3 className="text-2xl font-serif font-bold text-foreground">No matches found</h3>
            <p className="text-base text-muted-foreground mt-2 font-medium">Try clearing your search filters or select &quot;All&quot; regions to view the full list.</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {filteredDoctors.map((doctor, index) => (
            <Card key={doctor.id} className={`h-full hover:shadow-float transition-all duration-500 rounded-organic-${(index % 4) + 1} bg-white/70 group border border-border/50 hover:border-primary/30`}>
              <div className="flex flex-col gap-5 h-full">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-serif font-bold text-foreground group-hover:text-primary transition-colors">{doctor.name}</h3>
                      <span className="rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs font-bold text-primary">{doctor.yearsExperience}+ yrs</span>
                    </div>
                    <p className="text-sm font-bold text-secondary mt-1 tracking-wide">{doctor.title}</p>
                    <p className="text-sm text-muted-foreground font-medium flex items-center gap-2 mt-2">
                      <MapPin className="h-4 w-4 text-primary" /> {doctor.hospital}, {doctor.location}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-start md:justify-end">
                    {doctor.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-muted/50 px-3 py-1 text-xs font-bold text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-default">{tag}</span>
                    ))}
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-foreground font-medium flex-grow">{doctor.bio}</p>

                <div className="grid gap-4 md:grid-cols-2 mt-auto">
                  <div className="rounded-[1.5rem] border border-border/50 bg-background/50 px-4 py-4 backdrop-blur-sm">
                    <p className="text-xs font-bold tracking-wider uppercase text-muted-foreground mb-3 flex items-center gap-2">
                      Expertise focus
                    </p>
                    <ul className="space-y-2 text-sm font-medium text-foreground">
                      {doctor.specialties.map((specialty) => (
                        <li key={specialty} className="flex items-start gap-3">
                          <span className="mt-1.5 h-2 w-2 rounded-full bg-primary/60" aria-hidden />
                          {specialty}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-[1.5rem] border border-border/50 bg-background/50 px-4 py-4 backdrop-blur-sm space-y-4">
                    <div className="flex items-center gap-3 text-sm font-bold text-foreground">
                      <div className="p-1.5 bg-secondary/10 rounded-lg"><Languages className="h-4 w-4 text-secondary" /></div>
                      {doctor.languages.join(', ')}
                    </div>
                    <div>
                      <p className="text-xs font-bold tracking-wider uppercase text-muted-foreground mb-2 flex items-center gap-2">
                        Upcoming availability
                      </p>
                      <div className="space-y-2">
                        {doctor.nextSlots.map((slot) => (
                          <p key={slot.day} className="flex items-center gap-3 text-sm font-medium text-foreground">
                            <Clock className="h-4 w-4 text-primary/60" /> {slot.day}: {slot.times[0]}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-border/50">
                  <div className="flex items-center gap-4 text-sm font-bold">
                    <a href={`tel:${doctor.phone}`} className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors bg-primary/5 px-3 py-1.5 rounded-full">
                      <Phone className="h-4 w-4" /> {doctor.phone}
                    </a>
                    {doctor.videoUrl && (
                      <a href={doctor.videoUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-secondary hover:text-secondary/80 transition-colors bg-secondary/5 px-3 py-1.5 rounded-full">
                        <Video className="h-4 w-4" /> Video consult
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => navigate(`/consult/${doctor.id}/book`)}
                    className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 shadow-soft hover:-translate-y-0.5"
                  >
                    Check options
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-secondary/5 border-dashed border-secondary/20 rounded-organic-4">
        <p className="text-xs font-medium text-secondary/80 text-center leading-relaxed">
          The details above are informational and not an endorsement. Always confirm credentials, costs, and emergency protocols with the provider. If you already work with a neurologist you trust, share your Parkinson's care goals with them for continuity.
        </p>
      </Card>
    </div>
  );
};

export default Consult;
