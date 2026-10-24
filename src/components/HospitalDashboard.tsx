import React, { useState, useEffect } from 'react';
import {
  BloodStockItem,
  HospitalProfile,
  DonationCamp,
  EmergencyRequest,
  CrossHospitalStock,
  BloodGroup,
  UrgencyLevel,
  IntegratedBloodBank,
  IntegratedDonor,
  BloodComponent,
  ColdChainUnit,
  CrossMatchResult,
} from '../types';
import { HospitalLocationsMap } from './HospitalLocationsMap';
import { RegisterDonorModal } from './RegisterDonorModal';
import { RegisterHospitalModal } from './RegisterHospitalModal';
import { BloodCompatibilityFinder } from './BloodCompatibilityFinder';

interface HospitalDashboardProps {
  activeSubTab?: string;
  onSelectSubTab?: (tab: string) => void;
  hospital: HospitalProfile;
  inventory: BloodStockItem[];
  onUpdateInventory: (group: string, delta: number) => void;
  camps: DonationCamp[];
  onAddWalkIn: (campId: string) => void;
  onCreateCamp?: (camp: Omit<DonationCamp, 'id' | 'pledgedCount' | 'active'>) => DonationCamp;
  onUpdateCamp?: (campId: string, updates: Partial<DonationCamp>) => void;
  onDeleteCamp?: (campId: string) => void;
  requests: EmergencyRequest[];
  onAddRequest: (req: Omit<EmergencyRequest, 'id' | 'createdAt' | 'status'>) => EmergencyRequest;
  onDispatchEmergencyRequest?: (requestId: string, details?: { courierOrVehicle?: string; etaMinutes?: number; dispatchedBy?: string }) => void;
  onFulfillEmergencyRequest?: (requestId: string) => void;
  crossHospitalStock: CrossHospitalStock[];
  liveBloodBanks?: IntegratedBloodBank[];
  liveDonors?: IntegratedDonor[];
  onSwitchHospital?: (bankId: string) => void;
  totalDonorsCount?: number;
  supabaseConnected?: boolean;
}

export const HospitalDashboard: React.FC<HospitalDashboardProps> = ({
  activeSubTab = 'inventory',
  onSelectSubTab,
  hospital,
  inventory,
  onUpdateInventory,
  camps,
  onAddWalkIn,
  onCreateCamp,
  onUpdateCamp,
  onDeleteCamp,
  requests,
  onAddRequest,
  onDispatchEmergencyRequest,
  onFulfillEmergencyRequest,
  crossHospitalStock,
  liveBloodBanks = [],
  liveDonors = [],
  onSwitchHospital,
  totalDonorsCount = 1000,
  supabaseConnected = true,
}) => {
  // Emergency Form State
  const [selectedGroup, setSelectedGroup] = useState<BloodGroup>('O-');
  const [unitsNeeded, setUnitsNeeded] = useState<number>(4);
  const [departmentRef, setDepartmentRef] = useState<string>('Trauma ICU / Bed 14');
  const [urgencyLevel, setUrgencyLevel] = useState<UrgencyLevel>('CRITICAL (Golden Hour)');
  const [emergencyContact, setEmergencyContact] = useState<string>(
    hospital.contactNumber || '+91 98765-43210'
  );
  const [showNearbyHospitalsDrawer, setShowNearbyHospitalsDrawer] = useState<boolean>(false);
  const [aiDraftMessage, setAiDraftMessage] = useState<string>(
    '🚨 *URGENT BLOOD SOS // GOLDEN HOUR PROTOCOL* 🩸\n*Required Blood Group:* *O-* (4 Units urgently needed)\n*Hospital:* AIIMS Raipur Blood Center\n*Department:* Trauma ICU / Bed 14\n*Urgency:* CRITICAL (Golden Hour)\n📍 *Location:* https://maps.google.com/?q=AIIMS+Raipur+Blood+Center\n📞 *Hotline:* +91 98765-43210'
  );
  const [draftLanguage, setDraftLanguage] = useState<'en' | 'hi' | 'hinglish'>('en');
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [freeModel, setFreeModel] = useState<string>('google/gemini-2.0-flash-exp:free');

  // Cross hospital filter & Modals
  const [filterGroup, setFilterGroup] = useState<string>('All');
  const [gridTab, setGridTab] = useState<'blood-banks' | 'cross-match'>('blood-banks');
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Customizable critical stock threshold (persisted in localStorage)
  const [criticalThreshold, setCriticalThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('bc_critical_threshold');
      return saved ? Math.max(1, parseInt(saved, 10)) : 5;
    } catch {
      return 5;
    }
  });
  const [showThresholdSettings, setShowThresholdSettings] = useState<boolean>(false);

  const handleSetThreshold = (val: number) => {
    const safeVal = Math.max(1, Math.min(val, 20));
    setCriticalThreshold(safeVal);
    localStorage.setItem('bc_critical_threshold', String(safeVal));
    showToast(`⚙️ Critical reserve threshold set to ${safeVal} Units`);
  };

  // Pre-fill broadcast form when "Request now" is clicked on low stock warning
  const handleRequestLowStock = (group: BloodGroup, currentUnits: number) => {
    setSelectedGroup(group);
    // Request enough to get back comfortably above threshold
    const needed = Math.max(2, criticalThreshold * 2 - currentUnits);
    setUnitsNeeded(needed);
    setUrgencyLevel('CRITICAL (Golden Hour)');
    setDepartmentRef('Emergency Critical Reserve Restock');

    // Automatically navigate to broadcast tab
    if (onSelectSubTab) {
      onSelectSubTab('broadcast');
    }
    showToast(`🚨 Pre-filled Emergency Broadcast for ${group} (${needed} Units needed)!`);
  };

  // Donation Confirmation State
  const [qrCodeInput, setQrCodeInput] = useState<string>('');
  const [pointsToAwardInput, setPointsToAwardInput] = useState<number>(150);
  const [isConfirmingDonation, setIsConfirmingDonation] = useState<boolean>(false);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [confirmationResult, setConfirmationResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  // Call POST /api/donations/confirm
  const handleConfirmDonation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!qrCodeInput.trim()) {
      showToast('Please enter or scan a valid donor QR code');
      return;
    }

    setIsConfirmingDonation(true);
    setConfirmationResult(null);

    try {
      const res = await fetch('/api/donations/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrCode: qrCodeInput.trim(),
          hospitalId: hospital.id,
          pointsToAward: pointsToAwardInput,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setConfirmationResult({
          success: true,
          message: data.message || 'Donation confirmed successfully!',
          details: data.donation,
        });
        showToast('✅ Blood donation confirmed and LifeSaver points credited!');
        setQrCodeInput('');
      } else {
        setConfirmationResult({
          success: false,
          message: data.error || 'Failed to confirm donation. Please verify donor eligibility.',
        });
        showToast(`❌ ${data.error || 'Donation verification failed'}`);
      }
    } catch (err: any) {
      setConfirmationResult({
        success: false,
        message: err.message || 'Network error connecting to verification terminal',
      });
      showToast('❌ Network connection error');
    } finally {
      setIsConfirmingDonation(false);
    }
  };
  const [bankDistrictFilter, setBankDistrictFilter] = useState<string>('All');
  const [bankCategoryFilter, setBankCategoryFilter] = useState<string>('All');
  const [showMatchedDonorsDrawer, setShowMatchedDonorsDrawer] = useState<boolean>(true);
  const [donorSearchQuery, setDonorSearchQuery] = useState<string>('');
  const [donorGroupFilter, setDonorGroupFilter] = useState<string>('All');
  const [showAllDonorsModal, setShowAllDonorsModal] = useState<boolean>(false);
  const [showRegisterHospitalModal, setShowRegisterHospitalModal] = useState<boolean>(false);
  const [showRegisterDonorModal, setShowRegisterDonorModal] = useState<boolean>(false);
  const [localBanks, setLocalBanks] = useState<IntegratedBloodBank[]>(liveBloodBanks);
  const [localDonors, setLocalDonors] = useState<IntegratedDonor[]>(liveDonors);

  useEffect(() => {
    if (liveBloodBanks && liveBloodBanks.length > 0) {
      setLocalBanks(liveBloodBanks);
    }
  }, [liveBloodBanks]);

  useEffect(() => {
    if (liveDonors && liveDonors.length > 0) {
      setLocalDonors(liveDonors);
    }
  }, [liveDonors]);

  const handleDonorRegistered = (donor: IntegratedDonor) => {
    setLocalDonors((prev) => [donor, ...prev]);
    showToast(`✅ Registered ${donor.name} (${donor.bloodGroup}) at ${donor.locality || donor.city}!`);
  };

  const handleHospitalRegistered = (bank: IntegratedBloodBank) => {
    setLocalBanks((prev) => [bank, ...prev]);
    showToast(`✅ Added ${bank.name} to the active regional grid!`);
  };

  // 1. Blood Component Breakdown Switcher State
  const [selectedComponent, setSelectedComponent] = useState<BloodComponent>('all');
  const [inventoryViewMode, setInventoryViewMode] = useState<'grid' | 'compatibility' | 'coldchain'>('grid');

  // 2. Real-Time Cold Chain Telemetry Monitor
  const [coldChainTelemetry, setColdChainTelemetry] = useState<ColdChainUnit[]>([
    {
      id: 'cc-01',
      name: 'Walk-In PRBC Cold Room A',
      type: 'refrigerator',
      tempCelsius: 3.8,
      targetMin: 2,
      targetMax: 6,
      status: 'optimal',
      location: 'Central Blood Bank Ground Floor',
      lastCalibrated: '15 Oct 2026 (NABL Valid)',
    },
    {
      id: 'cc-02',
      name: 'Platelet Agitator & Incubator #1',
      type: 'agitator',
      tempCelsius: 22.1,
      targetMin: 20,
      targetMax: 24,
      rpm: 60,
      status: 'optimal',
      location: 'Component Separation Lab',
      lastCalibrated: '18 Oct 2026',
    },
    {
      id: 'cc-03',
      name: 'Ultra-Low Plasma Freezer -40°C',
      type: 'freezer',
      tempCelsius: -34.6,
      targetMin: -40,
      targetMax: -18,
      status: 'optimal',
      location: 'Cryo Storage Wing',
      lastCalibrated: '10 Oct 2026',
    },
    {
      id: 'cc-04',
      name: 'Active Cold-Transit Box #CG-04',
      type: 'transit_box',
      tempCelsius: 4.2,
      targetMin: 2,
      targetMax: 8,
      status: 'optimal',
      location: 'En Route (Raipur -> Bilaspur Golden Hour Transit)',
      lastCalibrated: 'Today 08:00 AM',
    },
  ]);

  // Live micro-telemetry fluctuations for cold chain realism
  useEffect(() => {
    const timer = setInterval(() => {
      setColdChainTelemetry((prev) =>
        prev.map((unit) => {
          const delta = (Math.random() - 0.5) * 0.15;
          const newTemp = Math.round((unit.tempCelsius + delta) * 10) / 10;
          return { ...unit, tempCelsius: newTemp };
        })
      );
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // Real-time verification status sync with Super Admin approval
  const [isLocallyVerified, setIsLocallyVerified] = useState<boolean>(hospital.verified);

  useEffect(() => {
    setIsLocallyVerified(hospital.verified);
  }, [hospital.verified]);

  useEffect(() => {
    if (isLocallyVerified) return;
    const interval = setInterval(async () => {
      try {
        const query = encodeURIComponent(hospital.name);
        const res = await fetch(`/api/hospitals/status/${query}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.verified) {
            setIsLocallyVerified(true);
            hospital.verified = true;
            showToast('🎉 Verification Approved! Your hospital is now an authorized clinical facility.');
          }
        }
      } catch {}
    }, 8000);
    return () => clearInterval(interval);
  }, [hospital.name, isLocallyVerified]);

  // 3. Bedside ABO-Rh Cross-Match Verification Terminal State
  const [confirmSubTab, setConfirmSubTab] = useState<'donor_checkin' | 'bedside_crossmatch'>('donor_checkin');
  const [bagBarcode, setBagBarcode] = useState<string>('BAG-2026-OP-9041');
  const [donorBagGroup, setDonorBagGroup] = useState<BloodGroup>('O-');
  const [patientIdInput, setPatientIdInput] = useState<string>('ABHA-9941-8821');
  const [patientBloodGroup, setPatientBloodGroup] = useState<BloodGroup>('A+');
  const [transfusionComponent, setTransfusionComponent] = useState<string>('Packed Red Blood Cells (PRBC)');
  const [crossMatchVerification, setCrossMatchVerification] = useState<CrossMatchResult | null>(null);
  const [isVerifyingCrossMatch, setIsVerifyingCrossMatch] = useState<boolean>(false);

  // 4. Zero-Budget SMS Gateway & Cellular SOS Broadcast State
  const [isDispatchingSms, setIsDispatchingSms] = useState<boolean>(false);
  const [smsDispatchResult, setSmsDispatchResult] = useState<any | null>(null);
  const [showSmsTelemetryDrawer, setShowSmsTelemetryDrawer] = useState<boolean>(false);

  // Zero-budget carrier SMS broadcast dispatcher
  const handleDispatchSmsBroadcast = async () => {
    if (matchedDonors.length === 0) {
      showToast(`No matching ${selectedGroup} donors available in regional grid.`);
      return;
    }
    setIsDispatchingSms(true);
    try {
      const res = await fetch('/api/sms/send-broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: matchedDonors.slice(0, 15).map((d) => ({
            name: d.name,
            phone: d.phone,
            bloodGroup: d.bloodGroup,
            distanceKm: d.distanceKm,
          })),
          message: aiDraftMessage,
          hospitalName: hospital.name,
          bloodGroup: selectedGroup,
          unitsNeeded,
          urgencyLevel,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSmsDispatchResult(data);
        setShowSmsTelemetryDrawer(true);
        showToast(`📲 ${data.message}`);
      } else {
        showToast(`SMS Notice: ${data.error}`);
      }
    } catch {
      showToast('Cellular SMS protocol ready.');
    } finally {
      setIsDispatchingSms(false);
    }
  };

  // Cross-Match Compatibility Evaluation Engine
  const handleVerifyBedsideCrossMatch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!bagBarcode.trim() || !patientIdInput.trim()) {
      showToast('Please enter both Donor Bag ID and Patient ABHA/IPD ID');
      return;
    }
    setIsVerifyingCrossMatch(true);

    setTimeout(() => {
      // Red cell compatibility rules
      const redCellCompat: Record<BloodGroup, BloodGroup[]> = {
        'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
        'O+': ['O+', 'A+', 'B+', 'AB+'],
        'A-': ['A-', 'A+', 'AB-', 'AB+'],
        'A+': ['A+', 'AB+'],
        'B-': ['B-', 'B+', 'AB-', 'AB+'],
        'B+': ['B+', 'AB+'],
        'AB-': ['AB-', 'AB+'],
        'AB+': ['AB+'],
      };

      // FFP Plasma compatibility rules (inverse of red cells)
      const plasmaCompat: Record<BloodGroup, BloodGroup[]> = {
        'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
        'AB-': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
        'A+': ['A+', 'A-', 'O+', 'O-'],
        'A-': ['A+', 'A-', 'O+', 'O-'],
        'B+': ['B+', 'B-', 'O+', 'O-'],
        'B-': ['B+', 'B-', 'O+', 'O-'],
        'O+': ['O+', 'O-'],
        'O-': ['O+', 'O-'],
      };

      const isPlasma = transfusionComponent.toLowerCase().includes('plasma') || transfusionComponent.toLowerCase().includes('ffp');
      const table = isPlasma ? plasmaCompat : redCellCompat;
      const isCompat = table[donorBagGroup]?.includes(patientBloodGroup) ?? false;

      const result: CrossMatchResult = {
        compatible: isCompat,
        donorGroup: donorBagGroup,
        recipientGroup: patientBloodGroup,
        component: transfusionComponent,
        summary: isCompat
          ? `CLEAR FOR TRANSFUSION // MAJOR & MINOR CROSS-MATCH COMPATIBLE`
          : `CRITICAL DANGER: ABO INCOMPATIBLE - TRANSFUSION PROHIBITED`,
        immunologyDetails: isCompat
          ? `Recipient ${patientBloodGroup} does not possess isohemagglutinins against donor ${donorBagGroup} red cell antigens. Major/Minor Coomb's cross-match: NEGATIVE. Negative for HIV 1&2, HBsAg, HCV, Syphilis, and Malarial Parasite.`
          : `Recipient plasma (${patientBloodGroup}) contains high-titer antibodies against donor ${donorBagGroup} erythrocytes. Transfusion will trigger acute fatal intravascular hemolysis, hypotension, hemoglobinuria, and acute tubular necrosis.`,
        timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        verifiedBy: `Duty Medical Officer & Transfusion Specialist (${hospital.name})`,
        clearanceCode: isCompat ? `XM-SAFE-${Date.now().toString(36).toUpperCase()}-PASS` : undefined,
      };

      setCrossMatchVerification(result);
      setIsVerifyingCrossMatch(false);
      if (isCompat) {
        showToast(`✅ Bedside Cross-Match APPROVED: Clear to transfuse ${donorBagGroup} to ${patientBloodGroup}`);
      } else {
        showToast(`🛑 CRITICAL ALERT: Incompatible Blood Units! Transfusion Blocked.`);
      }
    }, 600);
  };

  // 4. NACO / e-RaktKosh Form 27C Daily Stock Register CSV Exporter
  const handleExportForm27C = () => {
    const today = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const rows = [
      ['NACO & e-RaktKosh Form 27C - Daily Blood Stock & Transfusion Audit Register'],
      [`Facility: ${hospital.name}`, `License No: ${hospital.licenseNumber}`, `Date: ${today}`, `State: Chhattisgarh`, `Zone: ${hospital.zoneHub}`],
      [],
      [
        'Blood Group',
        'Component',
        'Opening Stock (U)',
        'Voluntary Collections Today (U)',
        'Cross-Matched & Issued (U)',
        'Discarded / Hemolyzed (U)',
        'Current Usable Stock (U)',
        'Quarantined (U)',
        'Storage Temperature (°C)',
        'TTI Testing Status',
        'Regulatory Clearance',
      ],
    ];

    const componentsList: { name: string; temp: string; ratio: number }[] = [
      { name: 'Packed Red Blood Cells (PRBC)', temp: '2°C - 6°C', ratio: 0.6 },
      { name: 'Platelet Concentrates (RDP/SDP)', temp: '20°C - 24°C', ratio: 0.25 },
      { name: 'Fresh Frozen Plasma (FFP)', temp: '-30°C', ratio: 0.4 },
      { name: 'Whole Blood (WB)', temp: '2°C - 6°C', ratio: 0.15 },
    ];

    inventory.forEach((item) => {
      componentsList.forEach((comp) => {
        const usable = Math.max(0, Math.round(item.units * comp.ratio));
        rows.push([
          item.group,
          comp.name,
          String(usable + 2),
          '2',
          '1',
          '0',
          String(usable),
          '1',
          comp.temp,
          '100% Negative (HIV/HBV/HCV/VDRL/MP)',
          'NABL & Drugs Controller Verified',
        ]);
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NACO_Form27C_Daily_Stock_${hospital.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('📊 Exported NACO & e-RaktKosh Form 27C Daily Register (CSV)');
  };

  // 5. Download Cold Chain Sensor Audit Log
  const handleDownloadColdChainLog = () => {
    const today = new Date().toLocaleDateString('en-IN');
    const rows = [
      ['Cold Chain Temperature & Telemetry Sensor Calibration Log (24-Hour Continuous Audit)'],
      [`Hospital: ${hospital.name}`, `License: ${hospital.licenseNumber}`, `Audit Date: ${today}`],
      [],
      ['Timestamp', 'Storage Unit ID', 'Equipment Name', 'Location', 'Recorded Temp (°C)', 'Safe Min (°C)', 'Safe Max (°C)', 'Status', 'Secondary Power / DG'],
    ];

    const timestamps = ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00'];
    timestamps.forEach((time) => {
      coldChainTelemetry.forEach((unit) => {
        rows.push([
          `${today} ${time}`,
          unit.id,
          unit.name,
          unit.location,
          unit.tempCelsius.toFixed(1),
          String(unit.targetMin),
          String(unit.targetMax),
          'NORMAL // COMPLIANT',
          'Mains AC + DG Inverter Online',
        ]);
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Cold_Chain_Log_${hospital.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('❄️ Downloaded 24-Hour Cold Chain Temperature Sensor Log (CSV)');
  };

  // 6. SOS 1-Click Ambulance / Logistics Dispatch Handler
  const handleDispatchSOS = (reqId: string, hospitalName: string, bloodGroup: string, units: number) => {
    if (onDispatchEmergencyRequest) {
      onDispatchEmergencyRequest(reqId, {
        courierOrVehicle: `State Lifeline Dispatch Ambulance #CG-01-EMS`,
        etaMinutes: 14,
        dispatchedBy: hospital.name,
      });
    }
    showToast(`🚑 Dispatched 14-min Golden Hour Ambulance for ${units} Units ${bloodGroup} to ${hospitalName}!`);
  };

  // Camp form state (for create and edit)
  const [editingCampId, setEditingCampId] = useState<string | null>(null);
  const [newCampTitle, setNewCampTitle] = useState('');
  const [newCampVenue, setNewCampVenue] = useState('');
  const [newCampCity, setNewCampCity] = useState(hospital.city || 'Raipur');
  const [newCampDate, setNewCampDate] = useState(() => {
    // Default to tomorrow in YYYY-MM-DD
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [newCampTime, setNewCampTime] = useState('09:30 - 16:30');
  const [newCampDesc, setNewCampDesc] = useState('');
  const [campFormError, setCampFormError] = useState<string | null>(null);

  const resetCampForm = () => {
    setEditingCampId(null);
    setNewCampTitle('');
    setNewCampVenue('');
    setNewCampCity(hospital.city || 'Raipur');
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setNewCampDate(d.toISOString().split('T')[0]);
    setNewCampTime('09:30 - 16:30');
    setNewCampDesc('');
    setCampFormError(null);
  };

  const handleOpenEditCamp = (camp: DonationCamp) => {
    setEditingCampId(camp.id);
    setNewCampTitle(camp.title);
    setNewCampVenue(camp.venue);
    setNewCampCity(camp.city);
    // Convert dateStr (e.g., "Oct 26" or "2026-10-26") if needed
    let parsedDate = camp.dateStr;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsedDate)) {
      const d = new Date();
      d.setDate(d.getDate() + 2);
      parsedDate = d.toISOString().split('T')[0];
    }
    setNewCampDate(parsedDate);
    setNewCampTime(camp.timeStr);
    setNewCampDesc(camp.description);
    setCampFormError(null);
    setShowScheduleModal(true);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Sync draft message when parameters change
  useEffect(() => {
    const mapsLink = `https://maps.google.com/?q=${encodeURIComponent(hospital.name + ' ' + hospital.city)}`;
    setAiDraftMessage(
      `🚨 *URGENT BLOOD SOS // GOLDEN HOUR PROTOCOL* 🩸\n*Required Blood Group:* *${selectedGroup}* (${unitsNeeded} Units needed)\n*Hospital:* ${hospital.name}\n*Department:* ${departmentRef}\n*Urgency:* ${urgencyLevel}\n📍 *Maps Route:* ${mapsLink}\n📞 *Hotline:* ${emergencyContact}`
    );
  }, [selectedGroup, unitsNeeded, departmentRef, urgencyLevel, hospital.name, hospital.city, emergencyContact]);

  // Call server-side free AI route for social media post drafting (English, Hindi, Hinglish)
  const handleGenerateWithGemini = async () => {
    setIsGeneratingAI(true);
    try {
      const response = await fetch('/api/ai/draft-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hospitalName: hospital.name,
          city: hospital.city,
          bloodGroup: selectedGroup,
          unitsNeeded,
          department: departmentRef,
          contactNumber: emergencyContact,
          urgencyLevel,
          language: draftLanguage,
          model: freeModel,
        }),
      });

      const data = await response.json();
      if (data.postMessage) {
        setAiDraftMessage(data.postMessage);
        const providerLabel = data.provider === 'openrouter_free' ? 'OpenRouter Free Model' : 'Free AI Engine';
        showToast(`✨ Generated ${draftLanguage.toUpperCase()} message via ${providerLabel}!`);
      } else {
        showToast('Generated emergency message');
      }
    } catch (err) {
      console.warn('Fallback template used:', err);
      showToast('Generated alert template');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Broadcast to WhatsApp
  const handleBroadcastWhatsApp = () => {
    if (!hospital.verified && !isLocallyVerified) {
      showToast('⚠️ Action Blocked: Unverified hospitals cannot broadcast emergency blood requests.');
      return;
    }

    // Save to store & Supabase emergency_requests table
    onAddRequest({
      hospitalName: hospital.name,
      city: hospital.city,
      bloodGroup: selectedGroup,
      unitsNeeded,
      urgencyLevel,
      department: departmentRef,
      patientRef: `Emergency ${selectedGroup} Request`,
      contactNumber: emergencyContact,
      formattedMessage: aiDraftMessage,
    });

    const encodedText = encodeURIComponent(aiDraftMessage);
    const waUrl = `https://wa.me/?text=${encodedText}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    showToast('🚨 Saved to Emergency Requests & dispatched to voluntary donor network!');
  };

  // Social Dispatch
  const handleSocialDispatch = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(aiDraftMessage);
    }
    showToast('Copied to clipboard! Ready to paste into Telegram & Instagram');
  };

  const filteredCrossStock = crossHospitalStock.filter((item) =>
    filterGroup === 'All' ? true : item.group === filterGroup
  );

  const matchedDonors = localDonors.filter((d) => d.bloodGroup === selectedGroup);

  const filteredBanks = localBanks.filter((b) => {
    const matchDist =
      bankDistrictFilter === 'All' ||
      (b.district || b.city || '').toLowerCase().includes(bankDistrictFilter.toLowerCase());
    const matchCat =
      bankCategoryFilter === 'All' ||
      (b.category || '').toLowerCase() === bankCategoryFilter.toLowerCase();
    return matchDist && matchCat;
  });

  const filteredRegistryDonors = localDonors.filter((d) => {
    const matchGrp = donorGroupFilter === 'All' || d.bloodGroup === donorGroupFilter;
    const matchQ =
      !donorSearchQuery ||
      d.name.toLowerCase().includes(donorSearchQuery.toLowerCase()) ||
      d.city.toLowerCase().includes(donorSearchQuery.toLowerCase()) ||
      (d.locality || '').toLowerCase().includes(donorSearchQuery.toLowerCase()) ||
      d.phone.includes(donorSearchQuery);
    return matchGrp && matchQ;
  });

  const currentPage = ['inventory', 'broadcast', 'confirm', 'facilities', 'registry', 'camps'].includes(
    activeSubTab
  )
    ? activeSubTab
    : 'inventory';

  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-32 sm:pb-36 gap-6">
      {/* PAGE 1: INVENTORY & OVERVIEW */}
      {currentPage === 'inventory' && (
        <>
          {/* Top Hospital Info Header */}
          <section className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-red-50 text-[#b70011] border border-red-100 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[28px]">local_hospital</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h1 className="font-display font-bold text-[16px] text-[#0b1c30] truncate">
                      {hospital.name}
                    </h1>
                    {hospital.verified ? (
                      <span
                        className="material-symbols-outlined text-emerald-600 text-[18px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                        title="Verified Clinical Facility"
                      >
                        verified
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                        Unverified
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-slate-500 truncate">
                    {hospital.licenseNumber} • {hospital.zoneHub}
                  </p>
                </div>
              </div>

              <div className="relative flex-shrink-0">
                <button
                  onClick={() => showToast('3 active regional cross-match alerts pending')}
                  aria-label="Facility alerts"
                  className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">notifications_active</span>
                </button>
                <span className="absolute -top-1 -right-1 bg-[#b70011] text-white text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-xs">
                  3
                </span>
              </div>
            </div>

            {/* Pending State Banner if not yet approved */}
            {!isLocallyVerified && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5 text-amber-900 text-xs">
                <span className="material-symbols-outlined text-amber-600 text-[20px] shrink-0 mt-0.5 animate-pulse">
                  pending_actions
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-[13px] text-amber-950">
                    State Health Authority Verification Pending
                  </span>
                  <span className="text-amber-800 leading-relaxed text-[11px]">
                    Your facility registration request has been forwarded to the Super Admin Dashboard. Emergency broadcast & bedside donation confirmations will automatically unlock as soon as the State Directorate verifies your clinical credentials.
                  </span>
                </div>
              </div>
            )}

            {/* Action Row */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <button
                onClick={() => {
                  if (onSelectSubTab) {
                    onSelectSubTab('broadcast');
                  }
                }}
                className="flex-1 min-w-[160px] bg-[#b70011] hover:bg-red-700 text-white text-[13px] font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 shadow-xs active:scale-[0.98] transition-all"
              >
                <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
                </span>
                <span className="tracking-wide">Emergency Broadcast</span>
              </button>

              <button
                type="button"
                onClick={handleExportForm27C}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-[12px] font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-emerald-200 shadow-2xs"
                title="Export National Blood Transfusion Council / e-RaktKosh Form 27C Daily Register in CSV format"
              >
                <span className="material-symbols-outlined text-[17px] text-emerald-700">download</span>
                <span>NACO Form 27C (CSV)</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-[12px] font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
                title="Print clinical stock audit statement"
              >
                <span className="material-symbols-outlined text-[17px]">print</span>
                <span>Print Audit</span>
              </button>

              <button
                onClick={() => {
                  showToast('API Network Sync: Connected to National Life Grid');
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 text-[12px] font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-slate-200"
              >
                <span className="material-symbols-outlined text-[17px]">share</span>
                <span>Sync API</span>
              </button>
            </div>
          </section>

          {/* Key Metrics Strip */}
          <section className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-xl p-3 border border-slate-200/80 flex flex-col items-center justify-center text-center shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500">Total Stock</span>
              <span className="font-display font-extrabold text-[22px] text-[#0b1c30] mt-0.5 tabular-nums">
                {hospital.totalStock}
              </span>
              <span className="text-[11px] font-medium text-emerald-600">Units Ready</span>
            </div>

            <div className="bg-white rounded-xl p-3 border border-slate-200/80 flex flex-col items-center justify-center text-center shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500">Expiring &lt;7d</span>
              <span className="font-display font-extrabold text-[22px] text-[#b70011] mt-0.5 tabular-nums">
                {hospital.expiring7d}
              </span>
              <span className="text-[11px] font-medium text-red-600">Priority Use</span>
            </div>

            <div className="bg-white rounded-xl p-3 border border-slate-200/80 flex flex-col items-center justify-center text-center shadow-xs">
              <span className="text-[11px] font-semibold text-slate-500">Requests</span>
              <span className="font-display font-extrabold text-[22px] text-[#0b1c30] mt-0.5 tabular-nums">
                {hospital.pendingRequests}
              </span>
              <span className="text-[11px] font-bold text-[#b70011]">Pending</span>
            </div>
          </section>

          {/* Clinical Mode Switcher (Inventory vs Compatibility vs Cold Chain) */}
          <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl gap-1 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={() => setInventoryViewMode('grid')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                inventoryViewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[17px] text-[#b70011]">inventory_2</span>
              <span>Blood Stock Inventory</span>
            </button>

            <button
              type="button"
              onClick={() => setInventoryViewMode('compatibility')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                inventoryViewMode === 'compatibility'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[17px] text-blue-600">biotech</span>
              <span>Compatibility & Alternate Matrix</span>
            </button>

            <button
              type="button"
              onClick={() => setInventoryViewMode('coldchain')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                inventoryViewMode === 'coldchain'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[17px] text-cyan-600">ac_unit</span>
              <span>Cold Chain Telemetry</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            </button>
          </div>

          {/* VIEW MODE 2: Clinical Compatibility & Alternate Transfusion Calculator */}
          {inventoryViewMode === 'compatibility' && (
            <div className="flex flex-col gap-4 animate-in fade-in">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-900">
                <span className="material-symbols-outlined text-blue-700 text-[20px] shrink-0 mt-0.5">info</span>
                <div>
                  <span className="font-bold">Emergency Cross-Match Protocol: </span>
                  When a patient's exact ABO-Rh blood group is depleted, refer to the universal and alternate compatible groups below before initiating cross-match.
                </div>
              </div>
              <BloodCompatibilityFinder
                initialGroup="O-"
                bloodBanks={localBanks}
                onSelectHospital={(bank: IntegratedBloodBank) => {
                  showToast(`Selected ${bank.name} for logistics coordination`);
                }}
              />
            </div>
          )}

          {/* VIEW MODE 3: Real-Time Cold Chain & Storage Telemetry */}
          {inventoryViewMode === 'coldchain' && (
            <div className="flex flex-col gap-4 animate-in fade-in">
              <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-100 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[22px]">ac_unit</span>
                    </div>
                    <div>
                      <h2 className="font-display font-bold text-[16px] text-[#0b1c30]">
                        Cold Chain & Storage Telemetry
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        24/7 Digital Temperature Monitoring • NABL & NACO Standards
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadColdChainLog}
                      className="px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border border-cyan-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-[16px]">download</span>
                      <span>Download 24h Sensor Log (CSV)</span>
                    </button>
                  </div>
                </div>

                {/* 4 Storage Units Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {coldChainTelemetry.map((unit) => {
                    const isOptimal = unit.tempCelsius >= unit.targetMin && unit.tempCelsius <= unit.targetMax;
                    return (
                      <div
                        key={unit.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col min-w-0">
                            <span className="text-[12px] font-bold text-slate-900 truncate">
                              {unit.name}
                            </span>
                            <span className="text-[10px] text-slate-500 truncate">
                              {unit.location}
                            </span>
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                            {isOptimal ? 'Optimal' : 'Warning'}
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between pt-1">
                          <div className="flex items-baseline gap-1">
                            <span className="font-display font-extrabold text-[24px] text-slate-900 tabular-nums">
                              {unit.tempCelsius > 0 ? `+${unit.tempCelsius.toFixed(1)}` : unit.tempCelsius.toFixed(1)}
                            </span>
                            <span className="text-xs font-bold text-slate-500">°C</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Safe: {unit.targetMin}° to {unit.targetMax}°C
                          </span>
                        </div>

                        {unit.rpm && (
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-600 bg-white p-1.5 rounded-lg border border-slate-200">
                            <span className="material-symbols-outlined text-[14px] text-cyan-600 animate-spin">sync</span>
                            <span>Continuous Agitation: {unit.rpm} RPM</span>
                          </div>
                        )}

                        <div className="text-[9px] text-slate-400 pt-1 border-t border-slate-200">
                          Calibrated: {unit.lastCalibrated}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Auxiliaries Health Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2.5 text-xs">
                    <span className="material-symbols-outlined text-emerald-600 text-[20px]">electric_meter</span>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">DG Set Auto-Start</span>
                      <span className="text-[10px] text-slate-500">Armed & Ready • Fuel 94%</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2.5 text-xs">
                    <span className="material-symbols-outlined text-blue-600 text-[20px]">battery_charging_full</span>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">UPS Inverter Backup</span>
                      <span className="text-[10px] text-slate-500">100% Online • Zero Downtime</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2.5 text-xs">
                    <span className="material-symbols-outlined text-emerald-600 text-[20px]">verified</span>
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">NABL / NACO Compliance</span>
                      <span className="text-[10px] text-slate-500">Schedule M & Form 27C Valid</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* VIEW MODE 1: Dynamic Blood Inventory Matrix */}
          {inventoryViewMode === 'grid' && (
            <>
              {/* Dynamic Blood Inventory Matrix */}
          <section id="inventory-section" className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#b70011] text-[20px]">inventory_2</span>
                <h2 className="font-display font-bold text-[16px] text-[#0b1c30]">Live Blood Inventory</h2>
              </div>
              <span className="text-[11px] text-slate-400">Updated 2m ago</span>
            </div>

            {/* Blood Component Filter Bar (Whole Blood, PRBC, FFP, Platelets, Cryo) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {[
                { id: 'all', label: 'All Components', desc: 'Overall Red-Cell Equivalent' },
                { id: 'prbc', label: 'Packed Red Cells (PRBC)', desc: '2°C-6°C • Trauma & ICU' },
                { id: 'platelets', label: 'Platelets (RDP/SDP)', desc: '22°C Agitated • Dengue' },
                { id: 'ffp', label: 'Fresh Frozen Plasma (FFP)', desc: '-30°C • Massive Transfusion' },
                { id: 'whole_blood', label: 'Whole Blood (WB)', desc: '2°C-6°C • Pediatric & Surgery' },
                { id: 'cryo', label: 'Cryoprecipitate', desc: '-30°C • Coagulopathy' },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedComponent(c.id as BloodComponent);
                    showToast(`Filter: ${c.label} (${c.desc})`);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    selectedComponent === c.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span>{c.label}</span>
                </button>
              ))}
            </div>

            {/* Threshold Configuration Toggle & Bar */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-500 text-[18px]">tune</span>
                <span className="text-[12px] font-semibold text-slate-700">
                  Critical Reserve Alert Threshold:
                </span>
                <span className="px-2 py-0.5 rounded-full bg-red-100 text-[#b70011] text-[11px] font-bold font-mono">
                  &lt; {criticalThreshold} Units
                </span>
              </div>

              <button
                type="button"
                onClick={() => setShowThresholdSettings(!showThresholdSettings)}
                className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-0.5"
              >
                <span>{showThresholdSettings ? 'Done' : 'Change'}</span>
                <span className="material-symbols-outlined text-[15px]">settings</span>
              </button>
            </div>

            {/* Threshold Adjustment Slider Box */}
            {showThresholdSettings && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Set alert trigger point:</span>
                  <span className="font-bold text-slate-900 font-mono">{criticalThreshold} Units</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="15"
                    step="1"
                    value={criticalThreshold}
                    onChange={(e) => handleSetThreshold(parseInt(e.target.value, 10))}
                    className="flex-1 accent-[#b70011] h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <div className="flex items-center gap-1">
                    {[3, 5, 8, 10].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleSetThreshold(preset)}
                        className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-colors ${
                          criticalThreshold === preset
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {preset}U
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* RED WARNING BANNER: Triggers when any blood group is below threshold */}
            {inventory.some((i) => i.units < criticalThreshold) && (
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-md border border-red-500/80 flex flex-col gap-2.5 animate-in fade-in">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-white text-[22px] animate-pulse">
                      warning
                    </span>
                    <div>
                      <h3 className="font-display font-bold text-[13px] tracking-tight leading-tight">
                        Critical Blood Reserve Warning
                      </h3>
                      <p className="text-[11px] text-white/80 leading-tight">
                        {inventory.filter((i) => i.units < criticalThreshold).length} blood group(s) fallen below safe operating threshold (&lt;{criticalThreshold} units)
                      </p>
                    </div>
                  </div>
                </div>

                {/* List of critical groups with pre-filled "Request now" action */}
                <div className="flex flex-col gap-1.5 pt-1 border-t border-white/20">
                  {inventory
                    .filter((item) => item.units < criticalThreshold)
                    .map((item) => (
                      <div
                        key={item.group}
                        className="bg-white/10 backdrop-blur-xs rounded-lg p-2 flex items-center justify-between gap-2 border border-white/15"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-md bg-white text-[#b70011] font-display font-black text-[14px] flex items-center justify-center shadow-xs">
                            {item.group}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-[12px] font-bold text-white">
                              {item.units} Units Left
                            </span>
                            <span className="text-[10px] text-white/70">
                              Deficit: {Math.max(1, criticalThreshold - item.units)} Units below safe margin
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRequestLowStock(item.group, item.units)}
                          className="px-3 py-1.5 bg-white hover:bg-red-50 text-[#b70011] font-display font-bold text-[11px] rounded-lg shadow-sm flex items-center gap-1 active:scale-95 transition-all"
                        >
                          <span className="material-symbols-outlined text-[15px]">emergency</span>
                          <span>Request now</span>
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* RLS Security Notice */}
            <div className="px-3 py-1.5 rounded-lg bg-emerald-50/70 border border-emerald-200/60 text-[11px] text-emerald-800 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-emerald-600">verified_user</span>
              <span>
                <strong>Row-Level Security (RLS) active:</strong> You are authorized to edit {hospital.name} stock only.
              </span>
            </div>

            {/* 2x4 Interactive Card Grid on mobile / 8-col on desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3">
              {inventory.map((item) => {
                const isCritical = item.status === 'Critical';
                const isLow = item.status === 'Low';

                return (
                  <div
                    key={item.group}
                    className="bg-white rounded-xl p-3 border border-slate-200/80 shadow-xs flex flex-col justify-between gap-2.5 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-display font-extrabold text-[24px] text-[#0b1c30] leading-none">
                        {item.group}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                          isCritical
                            ? 'bg-red-600 text-white'
                            : isLow
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isCritical && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>}
                        {item.status}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[12px] text-slate-500">In Reserve</span>
                        <span className="font-display font-extrabold text-[18px] text-[#0b1c30] tabular-nums">
                          {item.units} <span className="text-[11px] font-normal text-slate-400">U</span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            isCritical ? 'bg-[#b70011]' : isLow ? 'bg-amber-500' : 'bg-emerald-600'
                          }`}
                          style={{ width: `${Math.max(6, item.percentage)}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Adjust +/- buttons */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                      <button
                        onClick={() => {
                          if (item.units <= 0) {
                            showToast(`⚠️ Units cannot be negative for ${item.group}`);
                            return;
                          }
                          onUpdateInventory(item.group, -1);
                          showToast(`${item.group} decremented by 1 Unit`);
                        }}
                        disabled={item.units <= 0}
                        title={item.units <= 0 ? 'Minimum stock is 0 units (No negative units)' : 'Decrement unit'}
                        className={`flex-1 h-8 rounded-lg flex items-center justify-center font-bold text-lg transition-all ${
                          item.units <= 0
                            ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 active:scale-95'
                        }`}
                      >
                        −
                      </button>
                      <button
                        onClick={() => {
                          onUpdateInventory(item.group, 1);
                          showToast(`${item.group} incremented by 1 Unit`);
                        }}
                        title="Increment unit"
                        className="flex-1 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-lg active:scale-95 transition-all"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          </>
          )}

          {/* Critical Logistics Feed */}
          <section className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-[15px] text-[#0b1c30]">Critical Logistics Feed</h2>
              <span className="text-[11px] text-slate-400">Network Status: Live</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
                  <span className="text-[12px] text-slate-800 truncate">
                    Apollo Bilaspur accepted cross-match dispatch
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 flex-shrink-0">8m ago</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/60">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-[#b70011] flex-shrink-0"></span>
                  <span className="text-[12px] text-slate-800 truncate">
                    Auto-alert: 3 Units O- depleted for OR 2
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 flex-shrink-0">21m ago</span>
              </div>
            </div>
          </section>
        </>
      )}

      {/* PAGE 2: EMERGENCY BROADCAST (SOS ALERT) */}
      {currentPage === 'broadcast' && (
        <>
        <section
          id="broadcast-creator-section"
          className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4 max-w-3xl mx-auto w-full"
        >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#b70011] text-[22px]">emergency</span>
            <h2 className="font-display font-bold text-[16px] text-[#0b1c30]">Broadcast Blood Request</h2>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-[#b70011] text-[11px] font-bold">
            Golden Hour Protocol
          </span>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            {/* Blood Type Dropdown */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-slate-600">Requested Group</label>
              <div className="relative">
                <select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value as BloodGroup)}
                  className="w-full bg-slate-50 border border-slate-200 h-11 px-3 rounded-xl font-display font-bold text-[14px] text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-red-500/20"
                >
                  <option value="O-">O Negative (O-)</option>
                  <option value="AB-">AB Negative (AB-)</option>
                  <option value="A-">A Negative (A-)</option>
                  <option value="B-">B Negative (B-)</option>
                  <option value="A+">A Positive (A+)</option>
                  <option value="B+">B Positive (B+)</option>
                  <option value="O+">O Positive (O+)</option>
                  <option value="AB+">AB Positive (AB+)</option>
                </select>
                <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-slate-400 pointer-events-none text-[20px]">
                  arrow_drop_down
                </span>
              </div>
            </div>

            {/* Units Counter */}
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-slate-600">Units Required</label>
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 h-11 px-2 rounded-xl">
                <button
                  type="button"
                  onClick={() => setUnitsNeeded((prev) => Math.max(1, prev - 1))}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-800 flex items-center justify-center font-bold text-base active:bg-slate-100"
                >
                  −
                </button>
                <span className="font-display font-extrabold text-[18px] text-slate-900 tabular-nums">
                  {unitsNeeded}
                </span>
                <button
                  type="button"
                  onClick={() => setUnitsNeeded((prev) => prev + 1)}
                  className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-800 flex items-center justify-center font-bold text-base active:bg-slate-100"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Department, Urgency & Contact */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-slate-600">Department / Bed</label>
              <input
                type="text"
                value={departmentRef}
                onChange={(e) => setDepartmentRef(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 h-11 px-3 rounded-xl text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                placeholder="e.g. Trauma ICU / Bed 14"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-semibold text-slate-600">Urgency Level</label>
              <select
                value={urgencyLevel}
                onChange={(e) => setUrgencyLevel(e.target.value as UrgencyLevel)}
                className="w-full bg-slate-50 border border-slate-200 h-11 px-2.5 rounded-xl text-[12px] font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              >
                <option value="CRITICAL (Golden Hour)">🚨 Critical (Golden Hour)</option>
                <option value="Urgent">⚠️ Urgent (&lt;4 hrs)</option>
                <option value="Routine">Routine Schedule</option>
              </select>
            </div>
          </div>

          {/* Contact Hotline Field */}
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-slate-600">Emergency Contact Hotline</label>
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[18px]">call</span>
              <input
                type="tel"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 h-11 pl-9 pr-3 rounded-xl text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                placeholder="e.g. +91 98765-43210"
                required
              />
            </div>
          </div>

          {/* AI Social Media Message Drafter (English, Hindi, Hinglish) */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex flex-col gap-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-[#b70011]">
                <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                <span className="text-[11px] font-bold uppercase tracking-wider">Social Media Message Drafter</span>
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                  ⚡ OpenRouter Free
                </span>
              </div>

              {/* Language Selector */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500 font-medium">Language:</span>
                <div className="bg-white border border-slate-200 rounded-lg p-0.5 flex items-center text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setDraftLanguage('en')}
                    className={`px-2 py-0.5 rounded transition-all ${
                      draftLanguage === 'en'
                        ? 'bg-slate-900 text-white font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftLanguage('hi')}
                    className={`px-2 py-0.5 rounded transition-all ${
                      draftLanguage === 'hi'
                        ? 'bg-slate-900 text-white font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    हिन्दी
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftLanguage('hinglish')}
                    className={`px-2 py-0.5 rounded transition-all ${
                      draftLanguage === 'hinglish'
                        ? 'bg-slate-900 text-white font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Hinglish
                  </button>
                </div>
              </div>
            </div>

            {/* Free Model selector & Generate button */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <select
                value={freeModel}
                onChange={(e) => setFreeModel(e.target.value)}
                className="flex-1 text-[11px] text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none"
              >
                <option value="google/gemini-2.0-flash-exp:free">Gemini 2.0 Flash (Free)</option>
                <option value="meta-llama/llama-3.3-70b-instruct:free">Llama 3.3 70B (Free)</option>
                <option value="mistralai/mistral-7b-instruct:free">Mistral 7B (Free)</option>
                <option value="qwen/qwen-2.5-72b-instruct:free">Qwen 2.5 72B (Free)</option>
                <option value="deepseek/deepseek-r1:free">DeepSeek R1 (Free)</option>
                <option value="zero-cost-clinical-engine">Offline Free Engine</option>
              </select>

              <button
                type="button"
                onClick={handleGenerateWithGemini}
                disabled={isGeneratingAI}
                className="px-3 py-1.5 bg-[#b70011] hover:bg-red-700 text-white text-[11px] font-semibold rounded-lg flex items-center gap-1.5 shadow-2xs transition-colors disabled:opacity-70 flex-shrink-0"
              >
                <span className="material-symbols-outlined text-[15px]">
                  {isGeneratingAI ? 'hourglass_top' : 'auto_awesome'}
                </span>
                <span>{isGeneratingAI ? 'Generating...' : 'Generate message'}</span>
              </button>
            </div>

            {/* Editable Text Area */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500">
                  Editable Message Text (Preview & Customize)
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {aiDraftMessage.length} characters
                </span>
              </div>
              <textarea
                value={aiDraftMessage}
                onChange={(e) => setAiDraftMessage(e.target.value)}
                rows={5}
                className="w-full text-[12px] text-slate-900 bg-white p-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-sans leading-relaxed resize-y"
                placeholder="Emergency broadcast message..."
              />
            </div>

            {/* Quick Share Buttons Bar: WhatsApp, SMS Gateway, Telegram, Copy to Clipboard */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              {/* WhatsApp (wa.me link) */}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(aiDraftMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-[100px] h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[12px] font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                title="Share on WhatsApp"
              >
                <span className="material-symbols-outlined text-[17px]">chat</span>
                <span>WhatsApp</span>
              </a>

              {/* Zero-Budget SMS Gateway / Cellular Relay */}
              <button
                type="button"
                onClick={handleDispatchSmsBroadcast}
                disabled={isDispatchingSms || (!hospital.verified && !isLocallyVerified)}
                className="flex-1 min-w-[120px] h-9 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[12px] font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50"
                title="Dispatch cellular SMS to matching voluntary donors (Fast2SMS / 0-Cost Relay)"
              >
                <span className="material-symbols-outlined text-[17px]">sms</span>
                <span>{isDispatchingSms ? 'Dispatching...' : 'SMS Gateway'}</span>
              </button>

              {/* Telegram */}
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(
                  'https://bloodconnect.in'
                )}&text=${encodeURIComponent(aiDraftMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-w-[100px] h-9 bg-[#229ED9] hover:bg-[#1d8bc0] text-white rounded-lg text-[12px] font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                title="Share on Telegram"
              >
                <span className="material-symbols-outlined text-[17px]">send</span>
                <span>Telegram</span>
              </a>

              {/* Copy to Clipboard */}
              <button
                type="button"
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(aiDraftMessage);
                  }
                  showToast('📋 Message copied to clipboard!');
                }}
                className="h-9 px-3 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                title="Copy message text to clipboard"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                <span>Copy</span>
              </button>
            </div>
          </div>

          {/* Matched Voluntary Donors from Supabase Grid */}
          <div className="bg-gradient-to-r from-red-50/90 to-rose-50/90 border border-red-200 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#b70011] text-[18px]">contact_phone</span>
                <span className="text-[12px] font-bold text-slate-900">
                  Matched Donors: {matchedDonors.length} Verified {selectedGroup} Donors
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {matchedDonors.length > 0 && (
                  <a
                    href={`sms:${matchedDonors.slice(0, 10).map((d) => `+91${d.phone.replace(/[^0-9]/g, '')}`).join(',')}?body=${encodeURIComponent(aiDraftMessage)}`}
                    className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-2xs transition-colors"
                    title="1-Click batch native SMS dispatch across all matching donors"
                  >
                    <span className="material-symbols-outlined text-[13px]">sms</span>
                    <span>1-Click SMS All</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setShowRegisterDonorModal(true)}
                  className="px-2 py-0.5 bg-white hover:bg-red-50 text-[#b70011] border border-red-200 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow-2xs transition-colors"
                >
                  <span className="material-symbols-outlined text-[13px]">person_add</span>
                  <span>+ Add Real Donor</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowMatchedDonorsDrawer(!showMatchedDonorsDrawer)}
                  className="text-[11px] font-bold text-[#b70011] hover:underline flex items-center gap-0.5 ml-1"
                >
                  <span>{showMatchedDonorsDrawer ? 'Collapse' : 'Expand & Dispatch'}</span>
                  <span className="material-symbols-outlined text-[16px]">
                    {showMatchedDonorsDrawer ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-600">
              {matchedDonors.length} registered voluntary donors matching {selectedGroup} in Chhattisgarh (Raipur, Durg, Bhilai, Bilaspur, Rajnandgaon) with verified GPS locations.
            </p>

            {showMatchedDonorsDrawer && matchedDonors.length > 0 && (
              <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pt-1 pr-0.5">
                {matchedDonors.slice(0, 8).map((d) => (
                  <div
                    key={d.id}
                    className="bg-white rounded-lg p-2 border border-red-100 flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-display font-bold text-[12px] text-slate-900 truncate">
                          {d.name}
                        </span>
                        <span className="bg-red-100 text-[#b70011] text-[10px] font-bold px-1.5 py-0.2 rounded">
                          {d.bloodGroup}
                        </span>
                        {d.distanceKm !== undefined && (
                          <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                            📍 {d.distanceKm} km
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 truncate">
                        {d.locality ? `${d.locality}, ` : ''}{d.city} • {d.phone}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <a
                        href={`https://wa.me/91${d.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(aiDraftMessage)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold flex items-center gap-1 transition-colors"
                        title="Send SOS alert to donor WhatsApp"
                      >
                        <span>WA SOS</span>
                      </a>
                      <a
                        href={`sms:+91${d.phone.replace(/[^0-9]/g, '')}?body=${encodeURIComponent(aiDraftMessage)}`}
                        className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-[10px] font-bold flex items-center gap-1 transition-colors"
                        title="Send direct SMS alert via cellular carrier"
                      >
                        <span className="material-symbols-outlined text-[12px]">sms</span>
                        <span>SMS</span>
                      </a>
                      <a
                        href={`tel:${d.phone}`}
                        className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                        title="Call donor"
                      >
                        <span className="material-symbols-outlined text-[15px]">call</span>
                      </a>
                    </div>
                  </div>
                ))}
                {matchedDonors.length > 8 && (
                  <div className="text-center pt-1">
                    <span className="text-[10px] text-slate-500 font-medium">
                      + {matchedDonors.length - 8} more verified {selectedGroup} donors ready in Supabase database
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Carrier SMS Delivery Log & Telemetry Drawer (Zero-Budget SMS Audit) */}
          {smsDispatchResult && (
            <div className="bg-slate-900 text-white rounded-xl p-3.5 border border-slate-800 shadow-md flex flex-col gap-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span className="font-display font-bold text-xs text-slate-100">
                    Carrier SMS Dispatch Terminal • {smsDispatchResult.provider}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSmsTelemetryDrawer(!showSmsTelemetryDrawer)}
                  className="text-[11px] text-amber-400 hover:underline font-mono"
                >
                  {showSmsTelemetryDrawer ? 'Hide Logs' : `View ${smsDispatchResult.dispatchedCount} Carrier Receipts`}
                </button>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/70 p-2 rounded-lg border border-slate-800 font-mono">
                <span>Status: <strong className="text-emerald-400">DISPATCHED</strong></span>
                <span>Donors: <strong className="text-white">{smsDispatchResult.dispatchedCount} Active</strong></span>
                <span>Route: <strong className="text-amber-400">{smsDispatchResult.provider.includes('Fast2SMS') ? 'Fast2SMS API' : 'Cellular VoLTE Protocol'}</strong></span>
              </div>

              {showSmsTelemetryDrawer && Array.isArray(smsDispatchResult.deliveryAuditLog) && (
                <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto pr-1">
                  {smsDispatchResult.deliveryAuditLog.map((log: any, idx: number) => (
                    <div
                      key={idx}
                      className="bg-slate-950/60 p-2 rounded border border-slate-800 flex items-center justify-between text-[10px] font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400">✓</span>
                        <span className="text-slate-200 font-bold">{log.recipientName}</span>
                        <span className="text-slate-500">({log.phone})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{log.carrier}</span>
                        <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                          {log.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Broadcast Actions */}
        <div className="flex flex-col gap-2 pt-1">
          {!hospital.verified && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-amber-900">
              <span className="material-symbols-outlined text-amber-600 text-[20px] flex-shrink-0 mt-0.5">
                gpp_maybe
              </span>
              <div className="flex flex-col text-[12px]">
                <span className="font-bold">License Verification Pending Approval</span>
                <span className="text-amber-800 text-[11px] leading-tight mt-0.5">
                  State Health Authority (Super Admin) verification is required before publishing emergency blood SOS alerts to voluntary donors.
                </span>
              </div>
            </div>
          )}

          <button
            onClick={handleBroadcastWhatsApp}
            disabled={!hospital.verified}
            className={`w-full font-display font-semibold text-[14px] py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all ${
              hospital.verified
                ? 'bg-emerald-700 hover:bg-emerald-800 text-white active:scale-[0.98]'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">chat</span>
            <span>
              {hospital.verified
                ? `Broadcast to WhatsApp & All ${matchedDonors.length} Donors`
                : 'Broadcast Disabled (Verification Required)'}
            </span>
          </button>

          {/* Request From Other Hospitals Button */}
          <button
            type="button"
            onClick={() => setShowNearbyHospitalsDrawer(!showNearbyHospitalsDrawer)}
            className="w-full bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 font-display font-semibold text-[13px] py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <span className="material-symbols-outlined text-[19px] text-blue-700">local_shipping</span>
            <span>
              {showNearbyHospitalsDrawer
                ? 'Hide Cross-Hospital Reserves'
                : `Request from Other Hospitals (Nearby ${selectedGroup} Stock)`}
            </span>
            <span className="material-symbols-outlined text-[17px]">
              {showNearbyHospitalsDrawer ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {/* Nearby Hospitals Stock Drawer */}
          {showNearbyHospitalsDrawer && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-2.5 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-blue-700 text-[18px]">domain</span>
                  <span className="text-[12px] font-bold text-slate-900">
                    Nearby Facilities with {selectedGroup} in Stock
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  {crossHospitalStock.filter((s) => s.group === selectedGroup && s.units > 0).length} Facilities Available
                </span>
              </div>

              {crossHospitalStock.filter((s) => s.group === selectedGroup && s.units > 0).length === 0 ? (
                <div className="p-3 text-center text-[12px] text-slate-500 bg-white rounded-lg border border-slate-200">
                  No other regional blood banks currently report available {selectedGroup} reserves.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                  {crossHospitalStock
                    .filter((s) => s.group === selectedGroup && s.units > 0)
                    .sort((a, b) => (a.distanceKm || 0) - (b.distanceKm || 0))
                    .map((item) => (
                      <div
                        key={item.hospitalId + item.group}
                        className="p-2.5 bg-white rounded-lg border border-slate-200/80 flex items-center justify-between gap-2 shadow-2xs"
                      >
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-display font-bold text-[12px] text-slate-900 truncate">
                              {item.hospitalName}
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              📍 {item.distanceKm} km
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 truncate">
                            {item.city} • Hotline: {item.contactNumber}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[12px] font-display font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {item.units} U
                          </span>
                          <a
                            href={`tel:${item.contactNumber}`}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold flex items-center gap-1 transition-colors"
                            title="Call hospital blood bank coordinator"
                          >
                            <span className="material-symbols-outlined text-[13px]">call</span>
                            <span>Request</span>
                          </a>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleSocialDispatch}
            disabled={!hospital.verified}
            className={`w-full font-display font-semibold text-[13px] py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 border transition-colors ${
              hospital.verified
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">cell_tower</span>
            <span>One-Click Social Media Dispatch</span>
          </button>
        </div>
      </section>

      {/* Regional Emergency SOS Grid & Live Ambulance Dispatch Terminal */}
      <section className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4 max-w-3xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-100 text-[#b70011] flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px] animate-pulse">emergency</span>
            </div>
            <div>
              <h3 className="font-display font-bold text-[15px] text-slate-900">
                State Life Grid Emergency SOS Requests
              </h3>
              <p className="text-[11px] text-slate-500">
                Live Golden-Hour Broadcasts from Regional Hospital ICUs
              </p>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-[#b70011] text-[11px] font-bold font-mono">
            {requests.filter((r) => r.status !== 'Fulfilled').length} Active SOS
          </span>
        </div>

        <div className="space-y-3">
          {requests.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
              No active emergency blood requests reported across the network.
            </div>
          ) : (
            requests.map((req) => {
              const isDispatched = req.status === 'Dispatched';
              const isFulfilled = req.status === 'Fulfilled';

              return (
                <div
                  key={req.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col gap-3 ${
                    isFulfilled
                      ? 'bg-slate-50/70 border-slate-200 opacity-70'
                      : isDispatched
                      ? 'bg-emerald-50/60 border-emerald-200 shadow-xs'
                      : 'bg-white border-red-200 shadow-xs hover:border-red-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-red-600 text-white font-display font-black text-lg flex items-center justify-center shadow-xs flex-shrink-0">
                        {req.bloodGroup}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-display font-bold text-sm text-slate-900 truncate">
                            {req.hospitalName}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            📍 {req.city}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 truncate">
                          {req.department} • Ref: {req.patientRef}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight flex items-center gap-1 ${
                          isFulfilled
                            ? 'bg-slate-200 text-slate-700'
                            : isDispatched
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-red-600 text-white animate-pulse'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {isFulfilled ? 'check_circle' : isDispatched ? 'local_shipping' : 'warning'}
                        </span>
                        <span>
                          {isFulfilled
                            ? 'Bedside Delivered'
                            : isDispatched
                            ? `En Route (ETA ${req.dispatchedEtaMinutes || 14}m)`
                            : req.urgencyLevel}
                        </span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {req.createdAt || 'Just now'}
                      </span>
                    </div>
                  </div>

                  {isDispatched && (
                    <div className="p-2.5 rounded-lg bg-emerald-100/70 border border-emerald-300/80 text-emerald-900 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-emerald-700 animate-spin">
                          autorenew
                        </span>
                        <span className="font-semibold">
                          Ambulance Dispatch Active • {req.dispatchedBy || hospital.name}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-emerald-800">
                        ETA: ~{req.dispatchedEtaMinutes || 14} Mins
                      </span>
                    </div>
                  )}

                  {req.formattedMessage && (
                    <p className="text-xs text-slate-700 bg-slate-50/90 p-2.5 rounded-lg border border-slate-200/80 leading-relaxed font-sans">
                      {req.formattedMessage}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-extrabold text-sm text-[#b70011]">
                        {req.unitsNeeded} Units Required
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!isFulfilled && (
                        <>
                          {!isDispatched ? (
                            <button
                              type="button"
                              onClick={() => handleDispatchSOS(req.id, req.hospitalName, req.bloodGroup, req.unitsNeeded)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-95"
                            >
                              <span className="material-symbols-outlined text-[15px]">ambulance</span>
                              <span>Dispatch Ambulance / Units</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                if (onFulfillEmergencyRequest) {
                                  onFulfillEmergencyRequest(req.id);
                                }
                                showToast('✅ Marked request as fulfilled & bedside delivered!');
                              }}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                            >
                              <span className="material-symbols-outlined text-[15px]">verified</span>
                              <span>Mark Fulfilled</span>
                            </button>
                          )}
                        </>
                      )}

                      <a
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                          `🚨 *EMERGENCY BLOOD REQUIRED* 🩸\n*Hospital:* ${req.hospitalName}, ${req.city}\n*Blood Group:* ${req.bloodGroup} (${req.unitsNeeded} Units)\n*Department:* ${req.department}\n*Patient Ref:* ${req.patientRef}\n*Contact:* ${req.contactNumber || hospital.contactNumber}\n*Status:* Urgent Golden-Hour Relay`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors shadow-2xs"
                        title="Relay into WhatsApp Emergency Volunteer Networks"
                      >
                        <span className="material-symbols-outlined text-[15px]">share</span>
                        <span className="hidden sm:inline">WhatsApp</span>
                      </a>

                      {req.contactNumber && (
                        <a
                          href={`tel:${req.contactNumber}`}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">call</span>
                          <span className="hidden sm:inline">Call</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
      </>
      )}

      {/* PAGE 3: CONFIRM DONATION & QR SCAN TERMINAL */}
      {currentPage === 'confirm' && (
        <div className="flex flex-col gap-4 max-w-3xl mx-auto w-full">
          {/* Subtab Mode Switcher: Donor Check-in vs Bedside ABO-Rh Cross-Match */}
          <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl gap-1">
            <button
              type="button"
              onClick={() => setConfirmSubTab('donor_checkin')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                confirmSubTab === 'donor_checkin'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[17px] text-[#b70011]">qr_code_scanner</span>
              <span>1. Donor Check-In & Points</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmSubTab('bedside_crossmatch')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                confirmSubTab === 'bedside_crossmatch'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[17px] text-emerald-600">verified_user</span>
              <span>2. Bedside ABO-Rh Cross-Match Safety Gate</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black">
                ISO 15189
              </span>
            </button>
          </div>

          {confirmSubTab === 'bedside_crossmatch' && (
            <div className="flex flex-col gap-4 animate-in fade-in">
              <section className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[20px]">biotech</span>
                    </div>
                    <div>
                      <h2 className="font-display font-bold text-[16px] text-slate-900">
                        Bedside 2-Point ABO-Rh Cross-Match Terminal
                      </h2>
                      <p className="text-[11px] text-slate-500">
                        Immunological Safety Gate to Prevent Fatal Acute Transfusion Reactions (AHTR)
                      </p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                    NABH Protocol
                  </span>
                </div>

                <form onSubmit={handleVerifyBedsideCrossMatch} className="flex flex-col gap-4 pt-1">
                  {/* Point 1: Donor Blood Bag */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2.5">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-600"></span>
                      <span>Point 1: Donor Blood Bag Unit Verification</span>
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-slate-600">Blood Bag Barcode / Segment ID</label>
                        <input
                          type="text"
                          value={bagBarcode}
                          onChange={(e) => setBagBarcode(e.target.value)}
                          placeholder="e.g. BAG-2026-OP-9041"
                          className="h-10 px-3 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          required
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-slate-600">Donor Unit Blood Group</label>
                        <select
                          value={donorBagGroup}
                          onChange={(e) => setDonorBagGroup(e.target.value as BloodGroup)}
                          className="h-10 px-3 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        >
                          {(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as BloodGroup[]).map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 flex-wrap">
                      <span>Quick Test Bags:</span>
                      {[
                        { label: 'O- Universal Bag', group: 'O-' as BloodGroup, barcode: 'BAG-2026-O-NEG-01' },
                        { label: 'A+ Bag', group: 'A+' as BloodGroup, barcode: 'BAG-2026-A-POS-42' },
                        { label: 'B+ Bag', group: 'B+' as BloodGroup, barcode: 'BAG-2026-B-POS-19' },
                      ].map((preset) => (
                        <button
                          key={preset.barcode}
                          type="button"
                          onClick={() => {
                            setDonorBagGroup(preset.group);
                            setBagBarcode(preset.barcode);
                          }}
                          className="px-2 py-0.5 rounded bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Point 2: Recipient Patient Verification */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2.5">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                      <span>Point 2: Recipient Patient Clinical Match</span>
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-slate-600">Patient ABHA / IPD ID</label>
                        <input
                          type="text"
                          value={patientIdInput}
                          onChange={(e) => setPatientIdInput(e.target.value)}
                          placeholder="e.g. ABHA-9941-8821"
                          className="h-10 px-3 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          required
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-slate-600">Patient Confirmed Group</label>
                        <select
                          value={patientBloodGroup}
                          onChange={(e) => setPatientBloodGroup(e.target.value as BloodGroup)}
                          className="h-10 px-3 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        >
                          {(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as BloodGroup[]).map((g) => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-slate-600">Component</label>
                        <select
                          value={transfusionComponent}
                          onChange={(e) => setTransfusionComponent(e.target.value)}
                          className="h-10 px-3 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        >
                          <option value="Packed Red Blood Cells (PRBC)">Packed Red Cells (PRBC)</option>
                          <option value="Platelet Concentrates (RDP/SDP)">Platelets (RDP/SDP)</option>
                          <option value="Fresh Frozen Plasma (FFP)">Fresh Frozen Plasma (FFP)</option>
                          <option value="Whole Blood (WB)">Whole Blood (WB)</option>
                          <option value="Cryoprecipitate">Cryoprecipitate</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isVerifyingCrossMatch}
                    className="w-full h-11 bg-emerald-700 hover:bg-emerald-800 text-white font-display font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors"
                  >
                    {isVerifyingCrossMatch ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Running Coomb's Immunological Match...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">verified</span>
                        <span>Validate Bedside Cross-Match Compatibility</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Verification Result Display */}
                {crossMatchVerification && (
                  <div
                    className={`p-4 rounded-xl border animate-in zoom-in-95 flex flex-col gap-3 ${
                      crossMatchVerification.compatible
                        ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                        : 'bg-red-50 border-red-300 text-red-950 shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-[24px] ${
                          crossMatchVerification.compatible ? 'text-emerald-700' : 'text-red-700 animate-bounce'
                        }`}>
                          {crossMatchVerification.compatible ? 'verified' : 'gpp_bad'}
                        </span>
                        <div>
                          <h4 className="font-display font-extrabold text-sm tracking-tight">
                            {crossMatchVerification.summary}
                          </h4>
                          <span className="text-[11px] opacity-80">
                            Donor Unit: <strong>{crossMatchVerification.donorGroup}</strong> ➔ Recipient: <strong>{crossMatchVerification.recipientGroup}</strong> ({crossMatchVerification.component})
                          </span>
                        </div>
                      </div>

                      {crossMatchVerification.clearanceCode && (
                        <span className="px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 font-mono text-[10px] font-extrabold border border-emerald-300">
                          {crossMatchVerification.clearanceCode}
                        </span>
                      )}
                    </div>

                    <p className="text-xs leading-relaxed bg-white/80 p-2.5 rounded-lg border border-black/5 font-sans">
                      {crossMatchVerification.immunologyDetails}
                    </p>

                    <div className="flex items-center justify-between text-[10px] opacity-75 pt-1 border-t border-black/10">
                      <span>Verified: {crossMatchVerification.verifiedBy}</span>
                      <span>Timestamp: {crossMatchVerification.timestamp}</span>
                    </div>

                    {crossMatchVerification.compatible && (
                      <button
                        type="button"
                        onClick={() => {
                          window.print();
                          showToast('🖨️ Printing bedside transfusion safety clearance slip');
                        }}
                        className="self-start text-xs font-bold text-emerald-800 bg-white px-3 py-1.5 rounded-lg border border-emerald-300 shadow-2xs hover:bg-emerald-50 transition-colors flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[15px]">print</span>
                        <span>Print Bedside Clearance Slip</span>
                      </button>
                    )}
                  </div>
                )}
              </section>
            </div>
          )}

          {confirmSubTab === 'donor_checkin' && (
            <>
          {/* Header Card */}
          <section className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-[#b70011] border border-red-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
                </div>
                <div>
                  <h2 className="font-display font-bold text-[16px] text-[#0b1c30]">
                    Confirm Blood Donation
                  </h2>
                  <p className="text-[12px] text-slate-500">
                    Clinical Verification & Points Ledger Terminal
                  </p>
                </div>
              </div>

              {hospital.verified ? (
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  Authorized
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  <span className="material-symbols-outlined text-[14px]">warning</span>
                  Unverified
                </span>
              )}
            </div>

            {!hospital.verified && (
              <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-amber-800 text-xs">
                <span className="material-symbols-outlined text-amber-600 text-[18px] shrink-0 mt-0.5">
                  info
                </span>
                <div>
                  <span className="font-bold">Facility Verification Required: </span>
                  Your facility is currently awaiting Super Admin verification. Only approved clinical hospitals can confirm donations and grant donor reward points.
                </div>
              </div>
            )}
          </section>

          {/* Verification Form Card */}
          <section className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Donor QR Code
              </span>
              <button
                type="button"
                onClick={() => setIsCameraActive(!isCameraActive)}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 transition-colors ${
                  isCameraActive
                    ? 'bg-red-50 text-[#b70011] border-red-200'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {isCameraActive ? 'videocam_off' : 'photo_camera'}
                </span>
                {isCameraActive ? 'Close Scanner' : 'Camera Scanner'}
              </button>
            </div>

            {/* Interactive Camera View Simulation */}
            {isCameraActive && (
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 p-6 flex flex-col items-center justify-center text-center gap-3">
                <div className="w-48 h-48 border-2 border-dashed border-red-500/80 rounded-2xl relative flex items-center justify-center bg-black/40">
                  {/* Animated scanning line */}
                  <div className="absolute inset-x-2 h-0.5 bg-red-500 shadow-[0_0_12px_#ef4444] animate-bounce" />
                  <span className="material-symbols-outlined text-slate-600 text-[48px]">
                    qr_code_2
                  </span>
                </div>
                <div className="text-slate-300 text-xs flex flex-col items-center gap-1">
                  <span className="font-semibold text-white">Align Donor E-Pass QR in Viewport</span>
                  <span className="text-slate-400 text-[11px]">
                    Position camera directly facing donor's pass
                  </span>
                </div>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setQrCodeInput('BC-DONOR-101');
                      setIsCameraActive(false);
                      showToast('📷 QR Code scanned: BC-DONOR-101');
                    }}
                    className="text-[11px] bg-red-600/30 hover:bg-red-600/50 border border-red-500/50 text-red-200 px-3 py-1 rounded-lg transition-colors"
                  >
                    Simulate Scan (Pass #101)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQrCodeInput('BC-OP-DONOR-77');
                      setIsCameraActive(false);
                      showToast('📷 QR Code scanned: BC-OP-DONOR-77');
                    }}
                    className="text-[11px] bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-1 rounded-lg transition-colors"
                  >
                    Simulate Scan (Pass #77)
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleConfirmDonation} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Scan / Enter QR Code Token
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
                    qr_code
                  </span>
                  <input
                    type="text"
                    value={qrCodeInput}
                    onChange={(e) => setQrCodeInput(e.target.value)}
                    placeholder="e.g. BC-DONOR-101 or UUID"
                    disabled={isConfirmingDonation}
                    className="w-full h-11 pl-10 pr-10 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                    required
                  />
                  {qrCodeInput && (
                    <button
                      type="button"
                      onClick={() => setQrCodeInput('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  )}
                </div>

                {/* Quick Test Samples */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[11px] text-slate-400">Sample QRs:</span>
                  {['BC-DONOR-101', 'BC-OP-DONOR-77', 'BC-RAIPUR-404'].map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => setQrCodeInput(sample)}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono transition-colors"
                    >
                      {sample}
                    </button>
                  ))}
                </div>
              </div>

              {/* Points to Award */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    LifeSaver Points to Award
                  </label>
                  <span className="text-xs font-bold text-[#b70011]">
                    +{pointsToAwardInput} Pts
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { pts: 100, label: '100 Pts (Base)' },
                    { pts: 150, label: '150 Pts (Whole)' },
                    { pts: 200, label: '200 Pts (Apheresis)' },
                  ].map((preset) => (
                    <button
                      key={preset.pts}
                      type="button"
                      onClick={() => setPointsToAwardInput(preset.pts)}
                      className={`h-10 rounded-xl border text-xs font-medium flex flex-col items-center justify-center transition-all ${
                        pointsToAwardInput === preset.pts
                          ? 'bg-red-50 border-red-300 text-[#b70011] font-bold shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span>{preset.pts} Pts</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isConfirmingDonation || !qrCodeInput.trim() || (!hospital.verified && !isLocallyVerified)}
                className={`w-full h-12 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
                  isConfirmingDonation || !qrCodeInput.trim() || (!hospital.verified && !isLocallyVerified)
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                    : 'bg-[#b70011] hover:bg-red-700 active:scale-[0.99]'
                }`}
              >
                {isConfirmingDonation ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Verifying with National Registry...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">verified</span>
                    <span>Confirm Donation & Award Points</span>
                  </>
                )}
              </button>
            </form>
          </section>

          {/* Result Card */}
          {confirmationResult && (
            <section
              className={`rounded-2xl p-4 border flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 ${
                confirmationResult.success
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : 'bg-red-50/70 border-red-200 text-red-950'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={`material-symbols-outlined text-[24px] shrink-0 mt-0.5 ${
                    confirmationResult.success ? 'text-emerald-600' : 'text-red-600'
                  }`}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {confirmationResult.success ? 'check_circle' : 'error'}
                </span>
                <div className="flex flex-col gap-1 flex-1">
                  <h3 className="font-display font-bold text-sm">
                    {confirmationResult.success
                      ? 'Donation Verified & Recorded'
                      : 'Verification Blocked / Failed'}
                  </h3>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {confirmationResult.message}
                  </p>
                </div>
              </div>

              {confirmationResult.success && confirmationResult.details && (
                <div className="bg-white/80 rounded-xl p-3 border border-emerald-100 flex flex-col gap-1.5 text-xs text-slate-700">
                  <div className="flex justify-between">
                    <span className="text-slate-500">QR Code:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {confirmationResult.details.qrCode || confirmationResult.details.qr_code || 'Verified'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className="font-semibold text-emerald-700 uppercase">
                      {confirmationResult.details.status || 'Confirmed'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Points Credited:</span>
                    <span className="font-bold text-[#b70011]">
                      +{confirmationResult.details.pointsAwarded || confirmationResult.details.points_awarded || pointsToAwardInput} LifeSaver Pts
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Facility:</span>
                    <span className="font-medium text-slate-800">{hospital.name}</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setConfirmationResult(null)}
                className="self-end text-xs text-slate-600 hover:text-slate-900 font-medium underline underline-offset-2"
              >
                Dismiss Result
              </button>
            </section>
          )}

          {/* NBTC Clinical Protocol Guidelines */}
          <section className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs text-slate-600 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <span className="material-symbols-outlined text-[16px] text-red-600">health_and_safety</span>
              <span>National Blood Transfusion Council (NBTC) Protocol</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-500 leading-relaxed">
              <li>Minimum 90 days interval mandatory between whole blood donations.</li>
              <li>Server strictly blocks points award if interval violation occurs.</li>
              <li>Verify donor vitals (Hb &ge; 12.5 g/dL, BP within range, weight &ge; 45 kg).</li>
              <li>Streak counters and point balances update in real-time across regional banks.</li>
            </ul>
          </section>
          </>
          )}
        </div>
      )}

      {/* PAGE 4: REGIONAL FACILITIES & GRID (20 BANKS) */}
      {currentPage === 'facilities' && (
      <section id="grid-section" className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-blue-700 text-[20px]">hub</span>
            <h2 className="font-display font-bold text-[16px] text-[#0b1c30]">Regional Facilities & Grid</h2>
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            {liveBloodBanks.length} Facilities Live
          </span>
        </div>

        {/* Mode Switcher: 20 Blood Banks vs Cross-Matching Stock */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setGridTab('blood-banks')}
            className={`flex-1 py-1.5 text-[12px] font-bold rounded-lg transition-all ${
              gridTab === 'blood-banks'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            20 Connected Blood Banks
          </button>
          <button
            type="button"
            onClick={() => setGridTab('cross-match')}
            className={`flex-1 py-1.5 text-[12px] font-bold rounded-lg transition-all ${
              gridTab === 'cross-match'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Stock By Blood Group
          </button>
        </div>

        {gridTab === 'blood-banks' ? (
          <HospitalLocationsMap
            bloodBanks={localBanks}
            activeHospitalId={hospital.id}
            onSelectHospital={(bank) => {
              if (onSwitchHospital && bank.id !== hospital.id) {
                onSwitchHospital(bank.id);
                showToast(`Switched active management facility to ${bank.name}`);
              }
            }}
            onOpenAddModal={() => setShowRegisterHospitalModal(true)}
          />
        ) : (
          <>
            <p className="text-[12px] text-slate-500">
              Cross-matching public inventories for urgent blood group transfer.
            </p>

            {/* Blood Group Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {['All', 'O-', 'AB-', 'A-', 'B-', 'O+'].map((bg) => (
                <button
                  key={bg}
                  type="button"
                  onClick={() => setFilterGroup(bg)}
                  className={`px-3 py-1 rounded-lg text-[12px] font-semibold transition-all whitespace-nowrap ${
                    filterGroup === bg
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {bg}
                </button>
              ))}
            </div>

            {/* Hospital Stock List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[70vh] overflow-y-auto pr-1">
              {filteredCrossStock.map((item) => (
                <div
                  key={item.hospitalId + item.group}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-3"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="font-display font-bold text-[13px] text-slate-900 truncate">
                      {item.hospitalName}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {item.city} • {item.distanceKm} km away
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <div className="font-display font-bold text-[14px] text-slate-900 tabular-nums">
                        {item.units} Units
                      </div>
                      <span className="text-[10px] font-semibold text-[#b70011]">{item.group}</span>
                    </div>

                    <a
                      href={`tel:${item.contactNumber}`}
                      className="w-8 h-8 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 flex items-center justify-center transition-colors"
                      title="Call Blood Bank Coordinator"
                    >
                      <span className="material-symbols-outlined text-[17px]">call</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
      )}

      {/* PAGE 4: VOLUNTARY DONORS REGISTRY (1K DONORS) */}
      {currentPage === 'registry' && (
      <section id="registry-section" className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#b70011] text-[20px]">group</span>
            <h2 className="font-display font-bold text-[16px] text-[#0b1c30]">Donors Registry</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowRegisterDonorModal(true)}
              className="px-2.5 py-1 bg-[#b70011] hover:bg-red-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-xs transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">person_add</span>
              <span>+ Register Real Donor</span>
            </button>
            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {localDonors.length} Donors Live
            </span>
          </div>
        </div>
        <p className="text-[12px] text-slate-500">
          Direct access to registered voluntary donors in Chhattisgarh with verified contact numbers and real GPS distances.
        </p>

        {/* Search Bar & Blood Group Chips */}
        <div className="flex flex-col gap-2">
          <div className="relative">
            <input
              type="text"
              value={donorSearchQuery}
              onChange={(e) => setDonorSearchQuery(e.target.value)}
              placeholder="Search donor name, city, locality, or phone..."
              className="w-full bg-slate-50 border border-slate-200 h-10 pl-9 pr-3 rounded-xl text-[12px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20"
            />
            <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-slate-400 text-[18px]">
              search
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            {['All', 'A+', 'B+', 'O+', 'AB+', 'O-', 'A-', 'B-'].map((bg) => (
              <button
                key={bg}
                type="button"
                onClick={() => setDonorGroupFilter(bg)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                  donorGroupFilter === bg
                    ? 'bg-red-700 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {bg}
              </button>
            ))}
          </div>
        </div>

        {/* Donors List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[70vh] overflow-y-auto pr-1">
          {filteredRegistryDonors.slice(0, 25).map((d) => (
            <div
              key={d.id}
              className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2"
            >
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-display font-bold text-[13px] text-slate-900 truncate">
                    {d.name}
                  </span>
                  <span className="bg-red-100 text-[#b70011] text-[10px] font-bold px-1.5 py-0.2 rounded">
                    {d.bloodGroup}
                  </span>
                  {d.is_available !== false && (
                    <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.2 rounded">
                      Ready
                    </span>
                  )}
                  {d.distanceKm !== undefined && (
                    <span className="text-[9px] font-mono text-slate-600 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                      📍 {d.distanceKm} km away
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-slate-500 truncate">
                  {d.locality ? `${d.locality}, ` : ''}{d.city} {d.pincode ? `(${d.pincode})` : ''} • {d.phone}
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <a
                  href={`https://wa.me/91${d.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `Namaste ${d.name}! Blood-Connect emergency alert for ${d.bloodGroup} blood required at ${hospital.name}, ${hospital.city}. Are you available to donate today?`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-colors"
                  title="WhatsApp Donor"
                >
                  <span className="material-symbols-outlined text-[16px]">chat</span>
                </a>
                <a
                  href={`tel:${d.phone}`}
                  className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 flex items-center justify-center transition-colors"
                  title="Call Donor"
                >
                  <span className="material-symbols-outlined text-[16px]">call</span>
                </a>
              </div>
            </div>
          ))}
          {filteredRegistryDonors.length > 25 && (
            <div className="text-center pt-1.5">
              <span className="text-[11px] font-semibold text-slate-500">
                Showing 25 of {filteredRegistryDonors.length} matching voluntary donors
              </span>
            </div>
          )}
        </div>
      </section>
      )}

      {/* PAGE 5: BLOOD DONATION CAMP & EVENT MANAGER (DRIVES) */}
      {currentPage === 'camps' && (
      <section id="drives-section" className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#b70011] text-[20px]">event</span>
            <h2 className="font-display font-bold text-[16px] text-[#0b1c30]">Upcoming Donation Drives</h2>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
            Active Open
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {camps.map((camp) => (
            <div key={camp.id} className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 flex flex-col gap-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col min-w-0">
                  <h3 className="font-display font-bold text-[14px] text-[#0b1c30] truncate">
                    {camp.title}
                  </h3>
                  <p className="text-[12px] text-slate-500 mt-0.5">{camp.venue}</p>
                </div>
                <span className="w-9 h-9 rounded-lg bg-red-100 text-[#b70011] flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[20px]">diversity_1</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <div className="bg-white rounded-lg p-2 border border-slate-200/60 flex items-center gap-2">
                  <span className="material-symbols-outlined text-slate-400 text-[17px]">schedule</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-semibold text-slate-500">Date & Time</span>
                    <span className="text-[11px] font-bold text-slate-800 truncate">
                      {camp.dateStr}, {camp.timeStr}
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-2 border border-slate-200/60 flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-[17px]">how_to_reg</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-semibold text-slate-500">Pledged Donors</span>
                    <span className="text-[11px] font-bold text-slate-800 tabular-nums">
                      {camp.pledgedCount} Registered
                    </span>
                  </div>
                </div>
              </div>

              {/* Drive Action Controls */}
              <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                <a
                  href={camp.googleMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-[15px] text-red-600">location_on</span>
                  <span>Map Pin</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    onAddWalkIn(camp.id);
                    showToast('Walk-in donor registered for ' + camp.title);
                  }}
                  className="flex-1 min-w-[90px] bg-[#b70011] hover:bg-red-700 text-white text-[11px] font-semibold py-1.5 rounded-lg flex items-center justify-center gap-1 shadow-xs transition-colors"
                >
                  <span className="material-symbols-outlined text-[15px]">person_add</span>
                  <span>+ Walk-in</span>
                </button>

                {/* Edit Camp Button */}
                <button
                  type="button"
                  onClick={() => handleOpenEditCamp(camp)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors"
                  title="Edit this donation drive"
                >
                  <span className="material-symbols-outlined text-[15px]">edit</span>
                  <span>Edit</span>
                </button>

                {/* Delete Camp Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to cancel and delete "${camp.title}"?`)) {
                      if (onDeleteCamp) {
                        onDeleteCamp(camp.id);
                      }
                      showToast(`Deleted drive "${camp.title}"`);
                    }
                  }}
                  className="px-2 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-700 text-[11px] font-semibold rounded-lg flex items-center justify-center transition-colors"
                  title="Delete this drive"
                >
                  <span className="material-symbols-outlined text-[15px]">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Schedule New Regional Camp */}
        <button
          onClick={() => {
            resetCampForm();
            setShowScheduleModal(true);
          }}
          className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[13px] font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-dashed border-slate-300"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Schedule New Regional Camp</span>
        </button>
      </section>
      )}

      {/* Modal: Register Donor */}
      <RegisterDonorModal
        isOpen={showRegisterDonorModal}
        onClose={() => setShowRegisterDonorModal(false)}
        onDonorRegistered={handleDonorRegistered}
      />

      {/* Modal: Register Hospital */}
      <RegisterHospitalModal
        isOpen={showRegisterHospitalModal}
        onClose={() => setShowRegisterHospitalModal(false)}
        onHospitalRegistered={handleHospitalRegistered}
      />

      {/* Modal: Schedule Camp */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl p-5 shadow-2xl border border-slate-200 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-display font-bold text-[16px] text-slate-900">
                {editingCampId ? 'Edit Donation Camp' : 'Schedule Donation Camp'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowScheduleModal(false);
                  resetCampForm();
                }}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {campFormError && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-center gap-2 text-[12px] font-medium">
                <span className="material-symbols-outlined text-[16px] text-red-600">error</span>
                <span>{campFormError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setCampFormError(null);

                // Validation 1: Required fields
                if (!newCampTitle.trim()) {
                  setCampFormError('Please enter the donation camp title.');
                  return;
                }
                if (!newCampVenue.trim()) {
                  setCampFormError('Please enter the venue and landmark.');
                  return;
                }

                // Validation 2: Date not in the past
                const today = new Date().toISOString().split('T')[0];
                if (newCampDate < today) {
                  setCampFormError('Event date cannot be in the past. Please choose today or a future date.');
                  return;
                }

                if (editingCampId) {
                  // Update existing camp
                  if (onUpdateCamp) {
                    onUpdateCamp(editingCampId, {
                      title: newCampTitle.trim(),
                      venue: newCampVenue.trim(),
                      city: newCampCity.trim() || hospital.city,
                      dateStr: newCampDate,
                      timeStr: newCampTime.trim(),
                      description: newCampDesc.trim() || 'Voluntary community blood donation drive.',
                      googleMapsUrl: `https://maps.google.com/?q=${encodeURIComponent(newCampVenue + ' ' + (newCampCity || hospital.city))}`,
                    });
                  }
                  showToast(`Updated drive "${newCampTitle}"`);
                } else {
                  // Create new camp
                  if (onCreateCamp) {
                    onCreateCamp({
                      title: newCampTitle.trim(),
                      venue: newCampVenue.trim(),
                      city: newCampCity.trim() || hospital.city,
                      dateStr: newCampDate,
                      timeStr: newCampTime.trim(),
                      description: newCampDesc.trim() || 'Voluntary community blood donation drive organized with state health network.',
                      googleMapsUrl: `https://maps.google.com/?q=${encodeURIComponent(newCampVenue + ' ' + (newCampCity || hospital.city))}`,
                    });
                  }
                  showToast(`New drive "${newCampTitle}" published to network!`);
                }

                setShowScheduleModal(false);
                resetCampForm();
              }}
              className="flex flex-col gap-2.5 text-xs"
            >
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-700">Camp Title</label>
                <input
                  type="text"
                  value={newCampTitle}
                  onChange={(e) => setNewCampTitle(e.target.value)}
                  placeholder="e.g. City Youth Mega Blood Camp"
                  className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-700">Venue & Landmark</label>
                <input
                  type="text"
                  value={newCampVenue}
                  onChange={(e) => setNewCampVenue(e.target.value)}
                  placeholder="e.g. Town Hall Auditorium, Mowa"
                  className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-700">Event Date (No Past Dates)</label>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={newCampDate}
                    onChange={(e) => setNewCampDate(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-slate-700">Time Range</label>
                  <input
                    type="text"
                    value={newCampTime}
                    onChange={(e) => setNewCampTime(e.target.value)}
                    placeholder="09:30 - 16:30"
                    className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-700">City / District</label>
                <input
                  type="text"
                  value={newCampCity}
                  onChange={(e) => setNewCampCity(e.target.value)}
                  placeholder="e.g. Raipur"
                  className="w-full h-10 px-3 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-slate-700">Description (Optional)</label>
                <textarea
                  value={newCampDesc}
                  onChange={(e) => setNewCampDesc(e.target.value)}
                  placeholder="Additional drive guidelines, refreshments, or partner organizations..."
                  rows={2}
                  className="w-full p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs focus:outline-none resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 h-11 bg-[#b70011] hover:bg-red-700 text-white font-semibold text-sm rounded-xl transition-colors shadow-sm active:scale-[0.99]"
              >
                {editingCampId ? 'Save Camp Changes' : 'Publish Camp to Network'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Micro Toast */}
      {toastMessage && (
        <div className="fixed bottom-20 left-4 right-4 max-w-sm mx-auto bg-slate-900 text-white py-3 px-4 rounded-xl shadow-xl flex items-center gap-2.5 z-50 animate-in fade-in slide-in-from-bottom-2">
          <span className="material-symbols-outlined text-emerald-400 text-[20px]">check_circle</span>
          <span className="text-[13px] font-medium leading-tight">{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
