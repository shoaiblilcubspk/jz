import React from 'react';
import { BookOpen, ShoppingCart, Package, Users, Truck, PieChart, Shield } from 'lucide-react';

export function HowToUse() {
  const sections = [
    {
      title: "1. POS & Sales (Point of Sale)",
      icon: <ShoppingCart className="h-5 w-5 text-emerald-500" />,
      urdu: "پوائنٹ آف سیل دکان کا مین کاؤنٹر ہے جہاں سے بل بنتے ہیں۔ یہاں آپ بارکوڈ اسکین کرتے ہیں یا آئٹم سیلیکٹ کرتے ہیں۔ سسٹم خودکار طریقے سے ٹیکس اور ڈسکاؤنٹ کیلکولیٹ کرتا ہے۔ بل ادا کرتے وقت کیش، کارڈ، آن لائن اور کریڈٹ (ادھار) کے آپشنز ہوتے ہیں۔ آپ ایک ہی بل کو مختلف والٹس میں (Split) بھی کر سکتے ہیں۔",
      roman: "POS dukan ka main counter hai jahan se bills bante hain. Yahan aap barcode scan karte hain. System automatically tax aur discount calculate karta hai. Bill pay karte waqt Cash, Card, Online aur Credit (Udhaar) ke options hote hain. Aap ek hi bill ko split bhi kar sakte hain.",
      example: "Ali ne 1500 Rs ka bill banwaya, 1000 Rs Cash diye aur 500 Rs Credit (Udhaar) karwa liye. System inventory se stock minus karega, Cash Wallet mein 1000 add karega aur Ali ke khate mein 500 Rs ka udhaar dal dega."
    },
    {
      title: "2. Inventory & Stock Management",
      icon: <Package className="h-5 w-5 text-blue-500" />,
      urdu: "انوینٹری گودام کا حساب رکھتی ہے۔ ہر آئٹم کی نقل و حرکت 'اسٹاک ہسٹری' میں ریکارڈ ہوتی ہے۔ اگر اسٹاک زیرو ہو جائے تو سسٹم سیل روک دیتا ہے، لیکن اگر مالک چاہے تو سیٹنگز سے 'اوور سیلنگ' آن کر سکتا ہے۔",
      roman: "Inventory godaam ka hisaab rakhti hai. Har item ki movement 'Stock History' mein record hoti hai. Agar stock zero ho jaye tou system sale rok deta hai, lekin owner chahay tou 'Overselling' allow kar sakta hai.",
      example: "Aapne KFC Deal (Burger + Pepsi) sale ki. System background mein automatic dono items ka stock minus kar dega."
    },
    {
      title: "3. Customers & CRM (Udhaar Khata)",
      icon: <Users className="h-5 w-5 text-purple-500" />,
      urdu: "یہاں کسٹمرز کے ادھار کا حساب رکھا جاتا ہے۔ آپ ہر کسٹمر کی ایک 'کریڈٹ لمیٹ' سیٹ کر سکتے ہیں۔ جب کسٹمر ادھار لیتا ہے تو اس کا بیلنس (Debit) بڑھتا ہے، اور جب وہ ادائیگی کرتا ہے تو بیلنس (Credit) کم ہوتا ہے۔",
      roman: "Yahan customers ke udhaar ka hisaab rakha jata hai. Jab customer udhaar leta hai tou us ka balance (Debit) barhta hai, aur jab payment karta hai tou balance (Credit) kam hota hai.",
      example: "Raza ka 2000 Rs udhaar تھا. Usne 1500 Rs pay kiye. System ne uska baqiya udhaar 500 Rs kar diya aur 1500 Rs aapke Wallet mein daal diye."
    },
    {
      title: "4. Suppliers & Purchases",
      icon: <Truck className="h-5 w-5 text-orange-500" />,
      urdu: "یہ سپلائرز سے خریدے گئے مال کا کھاتہ ہے۔ جب آپ مال وصول کرتے ہیں تو انوینٹری بڑھتی ہے اور سپلائر کے کھاتے میں بل (Credit) بن جاتا ہے۔ جب آپ اسے پیمنٹ کرتے ہیں تو قرضہ کم ہو جاتا ہے۔",
      roman: "Ye suppliers se kharide gaye maal ka khata hai. Jab aap maal receive karte hain tou inventory barhti hai aur supplier ke khate mein bill (Credit) ban jata hai.",
      example: "Nestle se 10,000 Rs ka maal aaya. Aapne 5,000 Rs ada kiye. System ne stock add kiya aur supplier ke khate mein 5,000 Rs ka baqiya karza show kar diya."
    },
    {
      title: "5. Financial Reports & Wallets",
      icon: <PieChart className="h-5 w-5 text-pink-500" />,
      urdu: "یہ ڈیش بورڈ آپ کی اصل سیل اور لاگت (COGS) کا حساب لگا کر آپ کو خالص منافع (Net Profit) بتاتا ہے۔ اس کے علاوہ ہر والیٹ کا بیلنس الگ الگ ظاہر ہوتا ہے تاکہ رات کو گلے کا کیش ٹیلی کیا جا سکے۔",
      roman: "Ye dashboard aapki asal sale aur laagat (Cost) ka hisaab laga kar Net Profit batata hai. Har wallet (Cash, Card) ka hisaab alag alag show hota hai.",
      example: "Din mein 50,000 Rs ki sale hui, jis mein 30,000 Cash tha aur 20,000 udhaar. Cash Wallet mein sirf 30,000 show honge aur 20,000 Credit Wallet mein jayenge."
    },
    {
      title: "6. Roles & Permissions",
      icon: <Shield className="h-5 w-5 text-red-500" />,
      urdu: "سسٹم میں کیشیئر، مینیجر اور ایڈمن کے رولز ہیں۔ کیشیئر صرف بل بنا سکتا ہے۔ کسی بھی سیل کو ڈیلیٹ کرنے یا سیٹنگز بدلنے کے لیے ایڈمن کا پاسورڈ (PIN) درکار ہوتا ہے۔",
      roman: "System mein Cashier, Manager aur Admin ke roles hain. Cashier sirf bill bana sakta hai. Sale delete karne ke liye Admin ki permission/PIN chahiye hota hai.",
      example: "Agar cashier ghalti se bill bana de aur usay delete karna chahay, tou system delete nahi karega jab tak Admin apna PIN na dale."
    }
  ];

  return (
    <div className="space-y-6 w-full pb-32">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-6 sm:p-8 text-white shadow-lg">
        <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-white/80" />
          Zaynahs POS Guide
        </h2>
        <p className="mt-2 text-blue-100 font-medium">Complete system breakdown, flows, and examples to help you understand how Zaynahs POS works.</p>
      </div>

      <div className="space-y-6">
        {sections.map((section, idx) => (
          <div key={idx} className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 shrink-0">
                {section.icon}
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-white uppercase tracking-tighter">{section.title}</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div className="space-y-2 bg-gray-50/50 dark:bg-white/[0.02] p-4 rounded-2xl">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Roman Urdu</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed font-medium">{section.roman}</p>
              </div>
              <div className="space-y-2 bg-gray-50/50 dark:bg-white/[0.02] p-4 rounded-2xl" dir="rtl">
                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest text-left" dir="ltr">Urdu Script</p>
                <p className="text-[15px] text-gray-800 dark:text-gray-200 leading-loose font-noto">{section.urdu}</p>
              </div>
            </div>

            <div className="mt-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-500/20 p-4 rounded-2xl flex gap-3 items-start">
              <span className="text-lg">💡</span>
              <div>
                <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-1">Example / Misaal</p>
                <p className="text-sm text-emerald-800 dark:text-emerald-200/80 font-medium">{section.example}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
