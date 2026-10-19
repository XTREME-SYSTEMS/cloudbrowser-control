import React from "react";
import { Link } from "react-router-dom";
import { Scale, Mail, Phone, MapPin } from "lucide-react";

export default function SiteFooter() {
  return (
    <footer className="bg-[#06152a] text-slate-300">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0a1f3c] to-[#1a3a5c] flex items-center justify-center">
                <Scale className="w-5 h-5 text-[#c9a961]" />
              </div>
              <div className="leading-tight">
                <div className="font-serif text-base font-bold text-white">
                  Strategic Cloud Browser
                </div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-[#c9a961] font-semibold">
                  Heir Search · Probate Genealogy
                </div>
              </div>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed mb-5">
              Forensic genealogy services for the legal and trust professions since 1967.
              We find missing heirs a better way.
            </p>
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="text-[#c9a961] text-lg">★</span>
              ))}
              <span className="ml-2 text-xs text-slate-400">4.8/5 · 209 reviews</span>
            </div>
          </div>

          <div>
            <h4 className="font-serif text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Services
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#services" className="hover:text-[#c9a961] transition-colors">Estate Search</a></li>
              <li><a href="#services" className="hover:text-[#c9a961] transition-colors">Trust Search</a></li>
              <li><a href="#services" className="hover:text-[#c9a961] transition-colors">Notice Search</a></li>
              <li><a href="#services" className="hover:text-[#c9a961] transition-colors">Property Search</a></li>
              <li><a href="#services" className="hover:text-[#c9a961] transition-colors">Class Action</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-serif text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Company
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#pillars" className="hover:text-[#c9a961] transition-colors">Our Approach</a></li>
              <li><a href="#process" className="hover:text-[#c9a961] transition-colors">How It Works</a></li>
              <li><a href="#team" className="hover:text-[#c9a961] transition-colors">Our Team</a></li>
              <li><a href="#testimonials" className="hover:text-[#c9a961] transition-colors">Success Stories</a></li>
              <li><Link to="/heir-search-dashboard" className="hover:text-[#c9a961] transition-colors">Case Dashboard</Link></li>
              <li><Link to="/login" className="hover:text-[#c9a961] transition-colors">Client Login</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-serif text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Contact
            </h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <Mail className="w-4 h-4 text-[#c9a961] shrink-0 mt-0.5" />
                <span className="text-slate-400">contact@strategiccloudbrowser.com</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-[#c9a961] shrink-0 mt-0.5" />
                <span className="text-slate-400">(800) 555-0199</span>
              </li>
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#c9a961] shrink-0 mt-0.5" />
                <span className="text-slate-400">Worldwide Service · 65+ Countries</span>
              </li>
            </ul>
            <a
              href="#quote"
              className="mt-5 inline-flex items-center px-5 py-2.5 rounded-lg bg-[#c9a961] text-[#06152a] text-sm font-semibold hover:bg-[#d4b876] transition-colors"
            >
              Request a Quote
            </a>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Strategic Cloud Browser. All rights reserved.
            We Find Missing Heirs A Better Way™.
          </p>
          <div className="flex gap-6 text-xs text-slate-500">
            <a href="#" className="hover:text-[#c9a961] transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-[#c9a961] transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-[#c9a961] transition-colors">Accessibility</a>
          </div>
        </div>
      </div>
    </footer>
  );
}